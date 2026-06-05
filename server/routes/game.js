const router = require('express').Router();
const storage = require('../services/storage');
const { chatLLM, synthesizeVoice } = require('../services/ai');
const { ok, fail } = require('../utils/helpers');
const ws = require('../services/socket');
const { pinyin } = require('pinyin');

// ===== 题库生成（AI 优先，mock 降级）=====
router.post('/quiz/generate', async (req, res) => {
  const { type, count, difficulty } = req.body;
  const quizType = type || '企业文化';
  const quizCnt = count || 5;
  const diff = difficulty || 'medium';

  let quiz = null;

  // 1. 尝试用 AI 生成
  try {
    const prompt = `请生成${quizCnt}道年会"${quizType}"题目，难度"${diff}"。
要求：
- 每道题 4 个选项（A/B/C/D）
- 必须有一个明确正确答案
- 以纯 JSON 数组格式返回，不要 markdown 标记，不要额外说明
格式示例：
[{"question":"题目","options":["选项A","选项B","选项C","选项D"],"answer":"A","difficulty":"${diff}"}]`;
    const aiText = await chatLLM(prompt, { style: '正式大气', maxTokens: 2000, temperature: 0.9 });
    // 尝试提取 JSON 数组
    const jsonMatch = aiText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      const parsed = JSON.parse(jsonMatch[0]);
      if (Array.isArray(parsed) && parsed.length > 0 && parsed[0].question) {
        quiz = parsed.map((q, i) => ({
          question: q.question,
          options: q.options || ['A','B','C','D'],
          answer: q.answer || 'A',
          difficulty: q.difficulty || diff
        }));
      }
    }
  } catch {}

  // 2. AI 失败或结果无效，降级到 mock
  if (!quiz || quiz.length === 0) {
    quiz = generateMockQuiz(quizType, quizCnt, diff);
  }

  const gameData = storage.getGame();
  gameData.quiz = quiz;
  storage.saveGame(gameData);
  res.json(ok(quiz.map(q => ({ question: q.question, options: q.options, difficulty: q.difficulty }))));
});

// 提交答案 & 判题（支持单人/组队）
router.post('/quiz/submit', async (req, res) => {
  const { nickname, team, answers } = req.body;
  const gameData = storage.getGame();
  let score = 0;
  const results = [];

  for (const a of (answers || [])) {
    const q = gameData.quiz[a.index];
    const correct = q && q.answer === a.answer;
    if (correct) score++;
    results.push({ index: a.index, correct, correctAnswer: q ? q.answer : '?' });
  }

  if (!gameData.scores) gameData.scores = {};
  if (!gameData.teams) gameData.teams = {};

  const key = team ? ('team_' + team) : (nickname || '匿名');
  const current = gameData.scores[key] || 0;
  gameData.scores[key] = Math.max(current, score);
  if (team) {
    gameData.teams[team] = (gameData.teams[team] || 0) + score;
  }
  storage.saveGame(gameData);

  // AI 点评
  let comment = '';
  try { comment = await chatLLM('为得分' + score + '/' + (answers ? answers.length : 0) + '的年会答题选手写一句20字以内的趣味点评', { style: '幽默轻松' }); } catch {}
  res.json(ok({ score, total: answers ? answers.length : 0, results, comment: comment.slice(0, 100) }));
});

// 排行榜（含组队）
router.get('/ranks', (req, res) => {
  const gameData = storage.getGame();
  const mode = req.query.mode || 'solo';

  if (mode === 'team' && gameData.teams) {
    const ranks = Object.entries(gameData.teams)
      .map(([name, score]) => ({ name, score }))
      .sort((a, b) => b.score - a.score);
    return res.json(ok(ranks));
  }

  const ranks = Object.entries(gameData.scores || {})
    .filter(([k]) => !k.startsWith('team_'))
    .map(([name, score]) => ({ name, score }))
    .sort((a, b) => b.score - a.score);
  res.json(ok(ranks));
});

// ===== 成语接龙（共享状态 + WebSocket 实时同步）=====
let idiomState = { chain: [], prevWord: '', started: false };
// 获取字符的拼音（无声调，返回所有读音）
function getPinyins(ch) {
  try {
    const results = pinyin(ch, { heteronym: true, segment: false });
    if (!results || !results.length) return [];
    const arr = results[0] || [];
    // 去掉声调：NFD分解后去掉组合变音符号
    return arr.map(p => p.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase());
  } catch { return []; }
}

// 判断两个字符是否同音（含多音字匹配）
function isHomophone(a, b) {
  const pa = getPinyins(a);
  const pb = getPinyins(b);
  if (pa.length === 0 || pb.length === 0) return a === b;
  return pa.some(x => pb.includes(x));
}


router.post('/idiom/start', (req, res) => {
  idiomState = { chain: [], prevWord: '', started: true };
  ws.emit('idiom:state', idiomState);
  res.json(ok(idiomState));
});

router.post('/idiom/check', async (req, res) => {
  const { word, prevWord, difficulty } = req.body;
  // 如果服务端有状态，用服务端的 prevWord
  const serverPrev = idiomState.started ? idiomState.prevWord : '';
  const actualPrev = serverPrev || prevWord || '';
  
  if (actualPrev && word) {
    const prevLast = actualPrev.slice(-1);
    const wordFirst = word[0];
    if (!isHomophone(prevLast, wordFirst)) {
      const pp = getPinyins(prevLast).join('/') || '?';
      const wp = getPinyins(wordFirst).join('/') || '?';
      return res.json(ok({ valid: false, reason: '接龙失败！上一个字"' + prevLast + '"（' + pp + '），你接的是"' + wordFirst + '"（' + wp + '）开头，不同音！' }));
    }
  }
  if (!word || word.length < 2) {
    return res.json(ok({ valid: false, reason: '这不是有效的成语' }));
  }
  
  // 更新服务端状态
  if (idiomState.started || !actualPrev) {
    idiomState.chain.push(word);
    idiomState.prevWord = word;
    idiomState.started = true;
  }
  
  // AI 提示下家可接的成语
  let hint = '';
  const diff = difficulty || 'medium';
  const hintCount = diff === 'easy' ? 5 : diff === 'hard' ? 1 : 3;
  try { hint = await chatLLM('请以"' + (word ? word.slice(-1) : '年') + '"或其同音字开头，给出' + hintCount + '个常见成语（同音即可），逗号分隔', { style: '幽默轻松' }); } catch {}
  
  // 广播给所有人
  ws.emit('idiom:state', idiomState);
  
  res.json(ok({ valid: true, hint: hint.slice(0, 120) || '再接再厉！', difficulty: diff, chain: idiomState.chain, prevWord: idiomState.prevWord }));
});

router.post('/idiom/reset', (req, res) => {
  idiomState = { chain: [], prevWord: '', started: false };
  ws.emit('idiom:state', idiomState);
  res.json(ok(null, '已重置'));
});

router.get('/idiom/state', (req, res) => {
  res.json(ok(idiomState));
});

// ===== 飞花令判断 =====
router.post('/feihua/check', (req, res) => {
  const { word, keyword } = req.body;
  if (!word || !keyword) return res.json(fail('参数错误'));
  const valid = word.includes(keyword);
  res.json(ok({ valid, reason: valid ? '正确！含有"' + keyword + '"' : '诗句中不含关键字"' + keyword + '"' }));
});

// ===== 语音变声 =====
router.post('/voice/transform', async (req, res) => {
  const { text, voiceType } = req.body;
  if (!text) return res.json(fail('请输入文字'));
  try {
    const result = await synthesizeVoice(text, voiceType || '萝莉');
    res.json(ok(result));
  } catch (e) {
    res.json(fail('语音合成失败：' + e.message));
  }
});

// ===== Mock 题库（含难度）=====
function generateMockQuiz(type, count, difficulty) {
  const banks = {
    '企业文化': {
      easy: [
        { question: '公司的名称是什么？', options: ['A公司','B公司','C公司','D公司'], answer: 'A', difficulty:'easy' },
        { question: '公司口号是？', options: ['创新至上','客户第一','品质为本','以上都是'], answer: 'D', difficulty:'easy' },
      ],
      medium: [
        { question: '公司核心价值观是？', options: ['创新协作诚信共赢','速度规模利润扩张','自由开放平等分享','务实高效进取担当'], answer: 'A', difficulty:'medium' },
        { question: '公司成立于哪一年？', options: ['2010','2012','2015','2018'], answer: 'B', difficulty:'medium' },
      ],
      hard: [
        { question: '公司第一任CEO是谁？', options: ['张总','李总','王总','陈总'], answer: 'A', difficulty:'hard' },
        { question: '公司上市年份？', options: ['2018','2019','2020','未上市'], answer: 'D', difficulty:'hard' },
      ]
    },
    '新春灯谜': {
      easy: [
        { question: '大年初一（打一城市名）', options: ['北京','上海','广州','深圳'], answer: 'C', difficulty:'easy' },
        { question: '春节放什么？', options: ['鞭炮','烟花','音乐','以上都是'], answer: 'D', difficulty:'easy' },
      ],
      medium: [
        { question: '春节前夕（打一字）', options: ['庆','祝','春','联'], answer: 'A', difficulty:'medium' },
        { question: '除夕守岁数钟声（打一商业用语）', options: ['年终盘点','年终总结','年终奖','年末核算'], answer: 'A', difficulty:'medium' },
      ],
      hard: [
        { question: '大年初一（打《红楼梦》人名）', options: ['元春','迎春','探春','惜春'], answer: 'A', difficulty:'hard' },
        { question: '守岁（打《论语》一句）', options: ['终夜不寝','学而时习','有朋远来','三省吾身'], answer: 'A', difficulty:'hard' },
      ]
    },
    '脑筋急转弯': {
      easy: [
        { question: '什么布剪不断？', options: ['瀑布','棉布','丝绸','麻布'], answer: 'A', difficulty:'easy' },
        { question: '什么人不用电？', options: ['缅甸人','泰国人','中国人','日本人'], answer: 'A', difficulty:'easy' },
      ],
      medium: [
        { question: '什么东西越洗越脏？', options: ['水','衣服','抹布','手'], answer: 'A', difficulty:'medium' },
        { question: '什么东西明明是别人的你却用的更多？', options: ['名字','手机','钱','时间'], answer: 'A', difficulty:'medium' },
      ],
      hard: [
        { question: '有一种东西上升时同时会下降下降时同时会上升是什么？', options: ['跷跷板','电梯','温度计','血压'], answer: 'A', difficulty:'hard' },
        { question: '一头公牛加一头母牛猜三个字？', options: ['两头牛','一对牛','牛牛牛','不知道'], answer: 'A', difficulty:'hard' },
      ]
    }
  };

  const typeBank = banks[type] || banks['企业文化'];
  const all = [...(typeBank[difficulty] || typeBank['medium']), ...(typeBank['easy'] || [])];
  return all.slice(0, Math.min(count, all.length));
}


// ===== 摇一摇赛跑 =====
const shakeRaces = {}; // raceId -> { players: { nickname: { shakes, progress } }, active, targetShakes }

// 管理：开始赛跑
router.post('/shake/start', (req, res) => {
  const { targetShakes = 30 } = req.body;
  const raceId = Date.now().toString(36);
  shakeRaces[raceId] = { players: {}, active: true, targetShakes, startedAt: Date.now() };
  ws.emit('shake:raceStarted', { raceId, targetShakes });
  res.json(ok({ raceId }));
});

// 用户：加入赛跑
router.post('/shake/join', (req, res) => {
  const { raceId, nickname } = req.body;
  const race = shakeRaces[raceId];
  if (!race || !race.active) return res.json(fail('赛跑未开始或已结束'));
  if (!race.players[nickname]) {
    race.players[nickname] = { shakes: 0, progress: 0 };
  }
  res.json(ok({ players: Object.keys(race.players).length }));
});

// 用户：摇动一次
router.post('/shake/shake', (req, res) => {
  const { raceId, nickname } = req.body;
  const race = shakeRaces[raceId];
  if (!race || !race.active) return res.json(ok({ active: false }));
  const p = race.players[nickname];
  if (!p) return res.json(fail('请先加入赛跑'));
  p.shakes = Math.min(p.shakes + 1, race.targetShakes);
  p.progress = Math.round((p.shakes / race.targetShakes) * 100);
  // 广播排名
  const ranks = Object.entries(race.players)
    .map(([name, data]) => ({ nickname: name, shakes: data.shakes, progress: data.progress }))
    .sort((a, b) => b.shakes - a.shakes);
  ws.emit('shake:ranks', { raceId, ranks, active: race.active });
  // 检查是否有人到达终点
  if (p.shakes >= race.targetShakes) {
    race.active = false;
    ws.emit('shake:winner', { raceId, winner: nickname, ranks });
  }
  res.json(ok({ shakes: p.shakes, progress: p.progress }));
});

// 获取赛跑状态
router.get('/shake/state', (req, res) => {
  const { raceId } = req.query;
  const race = shakeRaces[raceId];
  if (!race) return res.json(ok({ active: false }));
  const ranks = Object.entries(race.players)
    .map(([name, data]) => ({ nickname: name, shakes: data.shakes, progress: data.progress }))
    .sort((a, b) => b.shakes - a.shakes);
  res.json(ok({ active: race.active, targetShakes: race.targetShakes, ranks }));
});

// 管理：重置赛跑
router.post('/shake/reset', (req, res) => {
  const { raceId } = req.body;
  if (raceId && shakeRaces[raceId]) delete shakeRaces[raceId];
  else Object.keys(shakeRaces).forEach(k => delete shakeRaces[k]);
  ws.emit('shake:reset');
  res.json(ok(null, '已重置'));
});

module.exports = router;
