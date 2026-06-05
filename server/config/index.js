// 优先加载 .env（本地开发）
try { require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '.env') }); } catch {}

const fs = require('fs');
const path = require('path');

let keyStore = {};
try {
  const kf = path.join(__dirname, '..', 'keys.json');
  if (fs.existsSync(kf)) keyStore = JSON.parse(fs.readFileSync(kf, 'utf-8'));
} catch {}
function K(name) { return process.env[name] || keyStore[name] || ''; }

module.exports = {
  adminToken: process.env.ADMIN_TOKEN || 'nianhui-admin-2026',
  port: process.env.PORT || 3456,

  wechat: {
    appId: K("WECHAT_APPID"),
    appSecret: K("WECHAT_APPSECRET"),
    oauthScope: K("WECHAT_SCOPE") || "snsapi_base",
  },

  ai: {
    // ===== 文本 =====
    text: {
      providers: [
        { name:'minimax-m27',  enabled:true, apiKey:K('MINIMAX_KEY'), endpoint:'https://api.minimax.chat/v1/text/chatcompletion_v2', model:'MiniMax-M2.7' },
        { name:'minimax',      enabled:true, apiKey:K('MINIMAX_KEY'), endpoint:'https://api.minimax.chat/v1/text/chatcompletion_v2', model:'abab6.5s-chat' },
        { name:'deepseek',     enabled:true, apiKey:K('DEEPSEEK_KEY'),endpoint:'https://api.deepseek.com/v1/chat/completions', model:'deepseek-chat' },
        { name:'qwen',        enabled:false, apiKey:K('QWEN_KEY'),   endpoint:'https://dashscope.aliyuncs.com/compatible-mode/v1/chat/completions', model:'qwen-turbo' },
        { name:'wenxin',      enabled:false, apiKey:K('WENXIN_KEY'), secretKey:K('WENXIN_SECRET'), endpoint:'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/chat/completions_pro', model:'ernie-speed-128k' },
        { name:'zhipu',       enabled:false, apiKey:K('ZHIPU_KEY'),  endpoint:'https://open.bigmodel.cn/api/paas/v4/chat/completions', model:'glm-4-flash' },
        { name:'doubao',      enabled:false, apiKey:K('DOUBAO_KEY'), endpoint:'https://ark.cn-beijing.volces.com/api/v3/chat/completions', model:'doubao-pro-32k' },
        { name:'kimi',        enabled:false, apiKey:K('KIMI_KEY'),   endpoint:'https://api.moonshot.cn/v1/chat/completions', model:'moonshot-v1-8k' },
      ], fallbackToMock: true,
    },
    // ===== 图像 =====
    image: {
      providers: [
        { name:'minimax-image', enabled:true, apiKey:K('MINIMAX_KEY'), endpoint:'https://api.minimax.chat/v1/image_generation', model:'image-01' },
        { name:'qwen-wanx',     enabled:false, apiKey:K('QWEN_KEY'),  endpoint:'https://dashscope.aliyuncs.com/api/v1/services/aigc/text2image/image-synthesis', model:'wanx-v1' },
        { name:'wenxin-image',  enabled:false, apiKey:K('WENXIN_KEY'), secretKey:K('WENXIN_SECRET'), endpoint:'https://aip.baidubce.com/rpc/2.0/ai_custom/v1/wenxinworkshop/text2image/sd_xl' },
      ], fallbackToMock: true,
    },
    // ===== 视频 =====
    video: {
      providers: [
        { name:'minimax-hailuo', enabled:true, apiKey:K('MINIMAX_KEY'), endpoint:'https://api.minimax.chat/v1/video_generation', model:'MiniMax-Hailuo-2.3' },
        { name:'minimax-video',  enabled:true, apiKey:K('MINIMAX_KEY'), endpoint:'https://api.minimax.chat/v1/video_generation', model:'video-01' },
      ], fallbackToMock: true,
    },
    // ===== 语音 =====
    voice: {
      providers: [
        { name:'minimax-tts-hd', enabled:true, apiKey:K('MINIMAX_KEY'), endpoint:'https://api.minimax.chat/v1/t2a_v2', model:'Speech-2.8-HD' },
        { name:'minimax-tts',    enabled:true, apiKey:K('MINIMAX_KEY'), endpoint:'https://api.minimax.chat/v1/t2a_v2', model:'speech-01-turbo' },
        { name:'xfyun',       enabled:false, appId:K('XFYUN_APPID'), apiKey:K('XFYUN_APIKEY'), apiSecret:K('XFYUN_APISECRET'), endpoint:'https://tts-api.xfyun.cn/v2/tts' },
        { name:'volcano-tts',   enabled:false, apiKey:K('VOLCANO_KEY'), appId:K('VOLCANO_APPID'), endpoint:'https://openspeech.bytedance.com/api/v1/tts' },
      ], fallbackToMock: true,
    },
    // ===== 音乐 =====
    music: {
      providers: [
        { name:'minimax-music', enabled:true, apiKey:K('MINIMAX_KEY'), endpoint:'https://api.minimax.chat/v1/music_generation', model:'music-2.6' },
      ], fallbackToMock: true,
    }
  },
  rateLimit: { perUserPerDay: 1000, windowMs: 86400000 },
  upload: { maxSize: 5242880, dir: './data/uploads', retentionHours: 72 },
  sensitiveWords: ['敏感词示例1','敏感词示例2']
};
