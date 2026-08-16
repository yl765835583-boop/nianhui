// ============================================================
//  AI 统一代理层 —— 多供应商架构
//  支持：DeepSeek / 通义千问 / 文心一言 / 智谱 / 豆包 / Kimi
//       通义万相 / 文心一格（图像）
//       讯飞 / 火山引擎（语音）
//  策略：按 config 优先级依次尝试，全失败时降级到 Mock
// ============================================================

const config = require('../config');

// ==================== 工具函数 ====================

/** 带超时的 fetch */
async function fetchWithTimeout(url, options = {}, timeoutMs = 30000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, { ...options, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(timer);
  }
}

/** 记录供应商调用日志 */
function log(provider, action, success, detail = '') {
  const icon = success ? '✅' : '❌';
  console.log(`[AI] ${icon} ${provider} | ${action} ${detail}`);
}

// ==================== Provider 路由器 ====================

/**
 * 按优先级尝试多个供应商，直到某个成功
 * @param {Array} providers - 供应商配置列表
 * @param {Function} callFn - 调用函数 (providerConfig) => Promise<result>
 * @param {boolean} fallbackToMock - 全失败后是否降级 Mock
 * @param {string} category - 类别名（text/image/voice）
 */
async function routeWithFallback(providers, callFn, fallbackToMock, category) {
  const enabled = providers.filter((p) => p.enabled && p.apiKey);

  if (enabled.length === 0) {
    console.log(`[AI] ⚠️  ${category}: 没有已启用且已配置 Key 的供应商，直接使用 Mock`);
    return null; // 返回 null 表示无可用供应商
  }

  for (const provider of enabled) {
    try {
      const result = await callFn(provider);
      log(provider.name, category, true, provider.model ? `model=${provider.model}` : '');
      return result;
    } catch (err) {
      log(provider.name, category, false, err.message.slice(0, 80));
      // 继续尝试下一个供应商
    }
  }

  // 全部失败
  console.log(`[AI] ❌ ${category}: 所有供应商均失败`);
  if (fallbackToMock) {
    console.log(`[AI] 🔄 ${category}: 降级到 Mock`);
    return null;
  }
  throw new Error(`所有 ${category} 供应商均不可用`);
}

// ==================== 文本大模型 ====================

/**
 * OpenAI 兼容格式调用（DeepSeek / 通义 / 智谱 / 豆包 / Kimi 均适用）
 */
async function callOpenAICompatible(provider, messages, maxTokens, temperature) {
  const body = {
    model: provider.model,
    messages,
    max_tokens: maxTokens,
    temperature: temperature,
  };
  const res = await fetchWithTimeout(provider.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`HTTP ${res.status}: ${errText.slice(0, 150)}`);
  }
  const data = await res.json();
  return data.choices[0].message.content;
}

/**
 * 文心一言特殊处理（需先换 access_token）
 */
let wenxinTokenCache = { token: '', expires: 0 };

async function callWenxin(provider, messages, maxTokens, temperature) {
  // 获取 access_token
  if (Date.now() > wenxinTokenCache.expires) {
    const tokenUrl = `https://aip.baidubce.com/oauth/2.0/token?grant_type=client_credentials&client_id=${provider.apiKey}&client_secret=${provider.secretKey}`;
    const tokenRes = await fetchWithTimeout(tokenUrl, { method: 'POST' });
    if (!tokenRes.ok) throw new Error('文心获取 token 失败');
    const tokenData = await tokenRes.json();
    wenxinTokenCache = {
      token: tokenData.access_token,
      expires: Date.now() + (tokenData.expires_in - 60) * 1000,
    };
  }

  const url = `${provider.endpoint}?access_token=${wenxinTokenCache.token}`;

  // 转换消息格式为文心格式
  const wenxinMessages = messages.map((m) => ({
    role: m.role === 'assistant' ? 'assistant' : 'user',
    content: m.content,
  }));

  const body = {
    messages: wenxinMessages,
    max_output_tokens: maxTokens,
    temperature,
  };
  const res = await fetchWithTimeout(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`文心 HTTP ${res.status}: ${errText.slice(0, 150)}`);
  }
  const data = await res.json();
  return data.result;
}

/**
 * 通用文本大模型调用（多供应商自动路由 + Mock 降级）
 */

/**
 * MiniMax 专用调用（非 OpenAI 格式）
 */
async function callMiniMax(provider, messages, maxTokens, temperature) {
  const body = {
    model: provider.model,
    messages: messages,
    stream: false,
    tokens_to_generate: Math.min(maxTokens, 4096),
    temperature: temperature,
  };
  const res = await fetchWithTimeout(provider.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${provider.apiKey}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`MiniMax HTTP ${res.status}: ${errText.slice(0, 150)}`);
  }
  const data = await res.json();
  // MiniMax 返回格式：base_resp.status_code === 0 表示成功
  if (data.base_resp && data.base_resp.status_code !== 0) {
    throw new Error(`MiniMax 错误: ${data.base_resp.status_msg}`);
  }
  // MiniMax 返回 OpenAI 兼容格式：choices[0].message.content
  if (data.choices && data.choices[0] && data.choices[0].message) {
    return data.choices[0].message.content;
  }
  throw new Error('MiniMax 响应格式异常');
}

// ==================== MiniMax 图像生成 ====================
async function callMiniMaxImage(provider, prompt, style) {
  const body = {
    model: provider.model,
    prompt: `年会风格${style}头像，${prompt}，精致，高质量，全身或半身肖像`,
    n: 1,
    size: '1024x1024',
    response_format: 'url',
  };
  const res = await fetchWithTimeout(
    provider.endpoint,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify(body),
    },
    60000
  );
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`MiniMax图像 HTTP ${res.status}: ${errText.slice(0, 150)}`);
  }
  const data = await res.json();
  if (data.base_resp && data.base_resp.status_code !== 0) {
    throw new Error(`MiniMax图像: ${data.base_resp.status_msg}`);
  }
  // 返回格式：data.data[0].url 或 data.result
  const url = (data.data && data.data[0] && data.data[0].url) || data.url || '';
  if (!url) throw new Error('MiniMax图像: 未获取到图片URL');
  return { url, style, provider: 'minimax' };
}

// ==================== MiniMax 视频生成 ====================
async function callMiniMaxVideo(provider, prompt, duration) {
  const body = {
    model: provider.model,
    prompt: prompt,
    duration: duration || 5,
    resolution: '720p',
  };
  const res = await fetchWithTimeout(
    provider.endpoint,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify(body),
    },
    120000
  );
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`MiniMax视频 HTTP ${res.status}: ${errText.slice(0, 150)}`);
  }
  const data = await res.json();
  if (data.base_resp && data.base_resp.status_code !== 0) {
    throw new Error(`MiniMax视频: ${data.base_resp.status_msg}`);
  }
  // 视频生成可能是异步的，返回 task_id 或直接 URL
  const videoUrl = (data.data && data.data[0] && data.data[0].url) || data.url || '';
  const taskId = data.task_id || '';
  return { url: videoUrl, taskId, provider: 'minimax' };
}

// ==================== MiniMax TTS 语音合成 ====================
async function callMiniMaxTTS(provider, text, voiceType) {
  const voiceMap = {
    萝莉: 'female-shaonv',
    大叔: 'male-qn-qingse',
    机器人: 'robot-01',
    财神音: 'presenter_male',
  };
  const body = {
    model: provider.model,
    text: text,
    stream: false,
    voice_setting: {
      voice_id: voiceMap[voiceType] || 'female-shaonv',
      speed: 1.0,
      pitch: voiceType === '萝莉' ? 200 : voiceType === '大叔' ? -200 : 0,
    },
    audio_setting: {
      sample_rate: 32000,
      format: 'mp3',
    },
  };
  const res = await fetchWithTimeout(
    provider.endpoint,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify(body),
    },
    30000
  );
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`MiniMax TTS HTTP ${res.status}: ${errText.slice(0, 150)}`);
  }
  const data = await res.json();
  if (
    data.base_resp &&
    data.base_resp.status_code !== 0 &&
    data.base_resp.status_code !== 20000000
  ) {
    throw new Error(`MiniMax TTS: ${data.base_resp.status_msg || 'unknown'}`);
  }
  // MiniMax TTS 返回 hex 编码的音频数据
  const audioHex = (data.data && data.data.audio) || data.audio || '';
  const audioUrl = audioHex
    ? `data:audio/mp3;base64,${Buffer.from(audioHex, 'hex').toString('base64')}`
    : '';
  return {
    url: audioUrl,
    msg: `[MiniMax] ${voiceType}: ${text.slice(0, 30)}...`,
    provider: 'minimax',
  };
}
async function chatLLM(prompt, options = {}) {
  const { style = '正式大气', maxTokens = 800, temperature = 0.8 } = options;
  const cfg = config.ai.text;

  const messages = [
    {
      role: 'system',
      content: `你是一个专业的年会文案创作助手。回答风格：${style}。请生成高质量、可直接使用的内容。`,
    },
    { role: 'user', content: prompt },
  ];

  const result = await routeWithFallback(
    cfg.providers,
    async (provider) => {
      switch (provider.name) {
        case 'minimax-m27':
        case 'minimax':
          return await callMiniMax(provider, messages, maxTokens, temperature);
        case 'wenxin':
          return await callWenxin(provider, messages, maxTokens, temperature);
        default:
          // deepseek / qwen / zhipu / doubao / kimi 均使用 OpenAI 兼容格式
          return await callOpenAICompatible(provider, messages, maxTokens, temperature);
      }
    },
    cfg.fallbackToMock,
    'text'
  );

  if (result !== null) return result;
  // Mock 降级
  return mockTextResponse(prompt, style);
}

// ==================== 图像生成 ====================

/**
 * 通义万相图像生成
 */
async function callQwenWanx(provider, prompt, style, width, height) {
  const body = {
    model: provider.model,
    input: {
      prompt: `年会风格头像，${style}风格，${prompt}，精致细节，高质量`,
    },
    parameters: {
      size: `${width}*${height}`,
      n: 1,
    },
  };
  const res = await fetchWithTimeout(provider.endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${provider.apiKey}`,
      'X-DashScope-Async': 'enable',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(`万相 HTTP ${res.status}`);
  const data = await res.json();

  // 异步任务：轮询结果
  if (data.output && data.output.task_id) {
    const taskId = data.output.task_id;
    const statusUrl = `https://dashscope.aliyuncs.com/api/v1/tasks/${taskId}`;
    for (let i = 0; i < 30; i++) {
      await sleep(1000);
      const statusRes = await fetchWithTimeout(statusUrl, {
        headers: { Authorization: `Bearer ${provider.apiKey}` },
      });
      const statusData = await statusRes.json();
      if (statusData.output && statusData.output.task_status === 'SUCCEEDED') {
        return { url: statusData.output.results[0].url, style };
      }
      if (statusData.output && statusData.output.task_status === 'FAILED') {
        throw new Error('万相生成失败');
      }
    }
    throw new Error('万相生成超时');
  }
  throw new Error('万相响应异常');
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function generateImage(prompt, options = {}) {
  const { style = '古风', width = 512, height = 512 } = options;
  const cfg = config.ai.image;

  const result = await routeWithFallback(
    cfg.providers,
    async (provider) => {
      switch (provider.name) {
        case 'minimax-image':
          return await callMiniMaxImage(provider, prompt, style);
        case 'qwen-wanx':
          return await callQwenWanx(provider, prompt, style, width, height);
        case 'wenxin-image':
          // TODO: 文心一格 API（需要类似 token 交换流程）
          throw new Error('文心一格暂未实现');
        default:
          throw new Error('未知图像供应商');
      }
    },
    cfg.fallbackToMock,
    'image'
  );

  if (result !== null) return result;
  return mockImageResponse(style);
}

// ==================== 语音合成 / 变声 ====================

async function synthesizeVoice(text, voiceType = '萝莉') {
  const cfg = config.ai.voice;

  const result = await routeWithFallback(
    cfg.providers,
    async (provider) => {
      switch (provider.name) {
        case 'minimax-tts-hd':
        case 'minimax-tts':
          return await callMiniMaxTTS(provider, text, voiceType);
        case 'xfyun':
          throw new Error('xfyun 接入待完成');
        case 'volcano-tts':
          throw new Error('volcano-tts 接入待完成');
        default:
          throw new Error('未知语音供应商');
      }
    },
    cfg.fallbackToMock,
    'voice'
  );

  if (result !== null) return result;
  return {
    url: '',
    msg: 'Mock: 已模拟合成 [' + voiceType + '] 音色: ' + text.slice(0, 20) + '...',
  };
}

// ==================== Mock 数据（降级用）====================

const mockCopywriting = {
  领导致辞: {
    正式大气:
      '尊敬的各位来宾、亲爱的同事们：\n\n大家晚上好！时光荏苒，岁月如歌。在这辞旧迎新的美好时刻，我们欢聚一堂，共同回顾过去一年的奋斗历程，展望新一年的宏伟蓝图。\n\n过去的一年，是充满挑战与机遇的一年。面对复杂多变的市场环境，全体同仁凝心聚力、攻坚克难，取得了令人瞩目的成绩。这些成绩的取得，离不开每一位员工的辛勤付出，离不开合作伙伴的鼎力支持，更离不开各位家属的理解与包容。\n\n新的一年，新的起点。让我们携手并进，以更加饱满的热情、更加昂扬的斗志，共同书写公司发展的新篇章！\n\n最后，预祝本次年会圆满成功！祝大家新年快乐、阖家幸福、万事如意！谢谢大家！',
    幽默轻松:
      '哈喽各位小伙伴！\n\n又是一年年会时，看到大家穿得这么光鲜亮丽，我差点没认出来——原来我的同事们不是只会穿格子衫写代码！（笑）\n\n过去这一年，咱们一起加班、一起吐槽、一起搞定了一个又一个难啃的项目。说实话，每次看到大家凌晨还在群里讨论方案，我都觉得——这公司稳了！\n\n今晚就别想工作了，吃好喝好，大奖等着你们！来，干杯！',
    温情走心:
      '亲爱的家人们：\n\n站在这里，看着台下每一张熟悉的面孔，心中涌起无限的感动。还记得年初那个雨夜，项目组通宵达旦；还记得夏日团建，大家在篝火旁分享梦想。这一年，我们不仅仅是同事，更像是家人。每一个加班的夜晚，每一次成功的喜悦，都因为有你们而变得意义非凡。新的一年，愿我们继续彼此温暖、彼此成就。谢谢你们。',
  },
  主持串词: {
    正式大气:
      '【开场】\n男：尊敬的各位领导、各位来宾\n女：亲爱的同事们、朋友们\n合：大家晚上好！\n男：岁月不居，天道酬勤\n女：时光如梭，奋斗如歌\n男：今晚，我们相聚在这里，共同迎来公司年度盛会\n女：让我们用最热烈的掌声，庆祝属于我们的荣耀时刻！\n\n【引出节目】\n男：接下来，精彩即将上演\n女：首先请欣赏由技术部带来的舞蹈——《代码也疯狂》！\n男：掌声有请！',
    幽默轻松:
      '【开场】\n主持人A：大家好，欢迎来到一年一度的年会盛典！\n主持人B：我是那个每年都被催婚的主持人——（笑）\nA：别说了，老板在台下看着呢。\nB：那咱们赶紧开始吧，趁老板还没扣工资！\n\n【引出节目】\nA：听说市场部的小伙伴们准备了一个小品，据说排练了整整三天！\nB：哇，三天！这敬业精神，我觉得应该给他们颁个奖——"最佳熬夜奖"！\nA：行了，有请市场部带来小品《甲方爸爸我爱你》！',
  },
  颁奖词: {
    正式大气:
      '他用汗水浇灌梦想，用实干诠释担当。在过去的一年里，他是团队的中流砥柱，用卓越的业绩交出了一份亮眼的答卷。他就是——年度优秀员工奖获得者！',
  },
  抽奖话术: {
    幽默轻松:
      '激动人心的时刻到了！现在要抽取的是今晚的三等奖！听说中奖率高达……呃，反正比找对象的概率高！来，让我们看看大屏幕——',
  },
  年会标语: {
    正式大气:
      '【推荐标语】\n1. 同心筑梦，共赢未来 —— XX公司2026年度盛典\n2. 龙腾虎跃迎新岁，齐心协力谱华章\n3. 奋斗者，正青春 —— XX年度表彰大会\n4. 聚力前行，无限可能\n5. 感恩有你，一路同行',
  },
};

const mockScripts = {
  小品: '【小品剧本：《年会那些事儿》】\n\n人物：\n- 小张：公司新人，热情但冒失\n- 老王：老员工，经验丰富但爱吐槽\n- 李总：部门经理\n\n【第一幕：年会筹备】\n场景：办公室\n\n小张（兴奋地跑进来）：老王老王！年会我要表演节目！\n老王（头也不抬）：哦，那你准备好社死了吗？\n小张：我准备了一段 rap！关于咱们公司的！\n老王（终于抬头）：……请你放过公司，也放过 rap。\n\n李总（推门进来）：聊什么呢这么热闹？对了小张，你的节目准备得怎么样了？\n小张：报告李总，已经准备好 80% 了！\n李总：那还差 20%？\n小张：对，还差词、曲、动作和——信心。\n老王：那你这是准备了 0% 吧！\n\n（全场笑）',
  脱口秀:
    '【脱口秀：《职场人的年终总结》】\n\n大家好，我是XX部的XX。\n\n又到了一年一度的年会了，我特别激动，因为终于有一天可以名正言顺地不在工位上摸鱼了。\n\n回顾这一年，我一共写了 847 封邮件，其中 846 封的开头都是"好的收到"，剩下那一封是"好的收到，但是……"——然后我就后悔了。',
  三句半:
    '【三句半：《夸夸咱公司》】\n\n甲：今天年会真热闹\n乙：兄弟姐妹齐欢笑\n丙：我来说段三句半\n丁：——开炮！\n\n甲：公司今年不简单\n乙：业绩蹭蹭往上攀\n丙：问咱秘诀是什么\n丁：——苦干！\n\n甲：行政部的姐姐好\n乙：零食饮料全管饱\n丙：就是体重刹不住\n丁：——长膘！',
};

const personaWords = [
  '披荆斩棘',
  '乘风破浪',
  '开天辟地',
  '稳如泰山',
  '锋芒毕露',
  '深藏不露',
  '笑傲江湖',
  '一马当先',
  '默默奉献',
  '闪闪发光',
  '后起之秀',
  '中流砥柱',
  '创意无限',
  '效率达人',
  '团队之光',
  '卷王之王',
];
const personaTags = [
  '会议终结者',
  '咖啡续命师',
  'PPT魔法师',
  'Deadline战神',
  '团建气氛组',
  '报销单收藏家',
  '打印机杀手',
  '外卖品鉴官',
  '摸鱼艺术家',
  '加班守夜人',
  '零食黑洞',
  '欢乐喜剧人',
];
const luckyQuotes = [
  '🎉 幸运之神今天选中了你！愿这份好运延续到新的一年，万事顺遂！',
  '🍀 恭喜中奖！你的运气证明了——"躺赢"也是一种实力！',
  '✨ 天选之子就是你！新的一年，愿你运气爆棚，好事连连！',
  '🎊 中奖快乐！今天的幸运只是开始，明年还有更大的惊喜等着你！',
];

function mockTextResponse(prompt, style) {
  for (const [key, styles] of Object.entries(mockCopywriting)) {
    if (prompt.includes(key)) return styles[style] || styles['正式大气'];
  }
  for (const [key, script] of Object.entries(mockScripts)) {
    if (prompt.includes(key)) return script;
  }
  if (prompt.includes('年度词') || prompt.includes('年度总结') || prompt.includes('人设')) {
    const word = personaWords[Math.floor(Math.random() * personaWords.length)];
    const tag = personaTags[Math.floor(Math.random() * personaTags.length)];
    return (
      '✨ 年度关键词：**' +
      word +
      '**\n🏷️ 趣味标签：**' +
      tag +
      '**\n📝 年度总结：这一年，你' +
      word +
      '，在平凡中创造了不凡。每一个努力的日子都值得被记住，新的一年继续发光发热！'
    );
  }
  if (prompt.includes('幸运') || prompt.includes('中奖')) {
    return luckyQuotes[Math.floor(Math.random() * luckyQuotes.length)];
  }
  return (
    '【Mock】AI 生成的回答。\n提示：' +
    prompt.slice(0, 100) +
    '\n风格：' +
    style +
    '\n\n配置 API Key 即可接入真实大模型（DeepSeek/通义/文心/智谱/豆包/Kimi）。'
  );
}

function mockImageResponse(style) {
  const colors = {
    财神: 'FF4444',
    古风: '8B7355',
    Q版: 'FFB6C1',
    职场潮人: '4169E1',
    年会礼服: 'FFD700',
  };
  const color = colors[style] || 'CCCCCC';
  return {
    url:
      'https://via.placeholder.com/512/' +
      color +
      '/fff?text=' +
      encodeURIComponent(style + '头像'),
    style,
  };
}

// ==================== 视频生成 ====================
async function generateVideo(prompt, options = {}) {
  const { duration = 5 } = options;
  const cfg = config.ai.video;

  const result = await routeWithFallback(
    cfg.providers,
    async (provider) => {
      switch (provider.name) {
        case 'minimax-hailuo':
        case 'minimax-video':
          return await callMiniMaxVideo(provider, prompt, duration);
        default:
          throw new Error('未知视频供应商');
      }
    },
    cfg.fallbackToMock,
    'video'
  );

  if (result !== null) return result;
  return {
    url: '',
    taskId: '',
    msg: 'Mock: 视频生成模拟完成（配置 MiniMax Key 即可生成真实视频）',
  };
}

// ==================== MiniMax 音乐生成 ====================
async function callMiniMaxMusic(provider, prompt, lyrics, duration) {
  const body = {
    model: provider.model,
    prompt: prompt,
    lyrics: lyrics || prompt,
    duration: duration || 30,
  };
  const res = await fetchWithTimeout(
    provider.endpoint,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${provider.apiKey}`,
      },
      body: JSON.stringify(body),
    },
    120000
  );
  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`MiniMax音乐 HTTP ${res.status}: ${errText.slice(0, 150)}`);
  }
  const data = await res.json();
  if (data.base_resp && data.base_resp.status_code !== 0) {
    throw new Error('MiniMax音乐: ' + data.base_resp.status_msg);
  }
  const audioUrl = data.data && data.data.audio ? data.data.audio : '';
  const taskId = data.task_id || '';
  return { url: audioUrl, taskId, provider: 'minimax' };
}

async function generateMusic(prompt, options = {}) {
  const { lyrics = '', duration = 30 } = options;
  const cfg = config.ai.music;

  const result = await routeWithFallback(
    cfg.providers,
    async (provider) => {
      switch (provider.name) {
        case 'minimax-music':
          return await callMiniMaxMusic(provider, prompt, lyrics, duration);
        default:
          throw new Error('未知音乐供应商');
      }
    },
    cfg.fallbackToMock,
    'music'
  );

  if (result !== null) return result;
  return { url: '', taskId: '', msg: 'Mock: 音乐生成模拟完成' };
}
module.exports = { chatLLM, generateImage, generateVideo, generateMusic, synthesizeVoice };
