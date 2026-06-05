const api = require('../../utils/api');

Page({
  data: {
    tab: 'quiz',
    quizType: '企业文化',
    quizTypes: ['企业文化','新春灯谜','脑筋急转弯'],
    difficulty: 'medium',
    difficulties: ['easy','medium','hard'],
    diffLabels: {easy:'简单',medium:'中等',hard:'困难'},
    teamMode: false,
    teamName: '',
    rankMode: 'solo',
    quiz: [],
    quizStarted: false,
    quizAnswers: {},
    quizSubmitted: false,
    quizScore: 0,
    quizComment: '',
    ranks: [],
    idiomPrev: '',
    idiomInput: '',
    idiomResult: '',
    idiomHint: '',
    idiomChain: [],
    feihuaKeyword: '',
    feihuaInput: '',
    feihuaResult: '',
    voiceText: '',
    voiceType: '萝莉',
    voiceTypes: ['萝莉','大叔','机器人','财神音'],
    voiceResult: '',
    // 视频
    videoPrompt: '',
    videoDuration: 6,
    videoTaskId: '',
    videoResult: '',
    // 音乐
    musicPrompt: '',
    musicLyrics: '',
    musicDuration: 30,
    musicTaskId: '',
    musicResult: '',
    loading: false
  },
  onShow() { this.loadRanks(); },
  switchTab(e) { this.setData({ tab: e.currentTarget.dataset.tab }); },
  selectQuizType(e) { this.setData({ quizType: e.currentTarget.dataset.value }); },
  selectDifficulty(e) { this.setData({ difficulty: e.currentTarget.dataset.value }); },
  toggleTeamMode() { this.setData({ teamMode: !this.data.teamMode }); },
  onTeamName(e) { this.setData({ teamName: e.detail.value }); },
  switchRankMode(e) { this.setData({ rankMode: e.currentTarget.dataset.value }); this.loadRanks(); },
  async startQuiz() {
    this.setData({ loading: true });
    try {
      const res = await api.generateQuiz({ type: this.data.quizType, count: 5, difficulty: this.data.difficulty });
      this.setData({ quiz: res.data, quizStarted: true, quizAnswers: {}, quizSubmitted: false });
    } catch { wx.showToast({ title: '加载失败', icon: 'none' }); }
    this.setData({ loading: false });
  },
  selectAnswer(e) {
    const { idx, opt } = e.currentTarget.dataset;
    const answers = { ...this.data.quizAnswers };
    answers[idx] = opt;
    this.setData({ quizAnswers: answers });
  },
  async submitQuiz() {
    const { quiz, quizAnswers } = this.data;
    const answers = [];
    for (let i = 0; i < quiz.length; i++) answers.push({ index: i, answer: quizAnswers[i] || '' });
    this.setData({ loading: true });
    try {
      const res = await api.submitQuiz({ nickname: this.data.teamMode ? '' : '玩家', team: this.data.teamMode ? (this.data.teamName || '队伍') : '', answers });
      this.setData({ quizSubmitted: true, quizScore: res.data.score, quizComment: res.data.comment });
      this.loadRanks();
    } catch { wx.showToast({ title: '提交失败', icon: 'none' }); }
    this.setData({ loading: false });
  },
  async loadRanks() {
    try { const res = await api.getRanks() + (this.data.rankMode === 'team' ? '?mode=team' : ''); this.setData({ ranks: res.data || [] }); } catch {}
  },
  onIdiomInput(e) { this.setData({ idiomInput: e.detail.value }); },
  async checkIdiom() {
    const { idiomInput, idiomPrev } = this.data;
    if (!idiomInput.trim()) return;
    this.setData({ loading: true });
    try {
      const res = await api.checkIdiom({ word: idiomInput, prevWord: idiomPrev || '' });
      if (res.data.valid) {
        const chain = [...this.data.idiomChain, idiomInput];
        this.setData({ idiomPrev: idiomInput, idiomChain: chain, idiomInput: '', idiomResult: '✅ 正确！', idiomHint: res.data.hint || '' });
      } else {
        this.setData({ idiomResult: '❌ ' + (res.data.reason || '接龙失败') });
      }
    } catch {}
    this.setData({ loading: false });
  },
  onFeihuaKw(e) { this.setData({ feihuaKeyword: e.detail.value }); },
  onFeihuaInput(e) { this.setData({ feihuaInput: e.detail.value }); },
  async checkFeihua() {
    const { feihuaInput, feihuaKeyword } = this.data;
    if (!feihuaInput.trim() || !feihuaKeyword.trim()) return;
    try {
      const res = await api.checkFeihua({ word: feihuaInput, keyword: feihuaKeyword });
      this.setData({ feihuaResult: res.data.valid ? '✅ 正确！' : '❌ ' + res.data.reason, feihuaInput: '' });
    } catch {}
  },
  onVoiceText(e) { this.setData({ voiceText: e.detail.value }); },
  selectVoice(e) { this.setData({ voiceType: e.currentTarget.dataset.value }); },
  async doTransform() {
    const { voiceText, voiceType } = this.data;
    if (!voiceText.trim()) return;
    this.setData({ loading: true });
    try {
      const res = await api.transformVoice({ text: voiceText, voiceType });
      this.setData({ voiceResult: res.data.msg || '合成完成' });
    } catch {}
    this.setData({ loading: false });
  },

  // === 视频 ===
  onVideoPrompt(e) { this.setData({ videoPrompt: e.detail.value }); },
  onVideoDuration(e) { this.setData({ videoDuration: parseInt(e.detail.value) || 6 }); },
  async doGenerateVideo() {
    const { videoPrompt, videoDuration } = this.data;
    if (!videoPrompt.trim()) { wx.showToast({ title:'请输入视频描述', icon:'none' }); return; }
    this.setData({ loading: true });
    try {
      const res = await api.generateVideo({ prompt: videoPrompt, duration: videoDuration });
      this.setData({ videoResult: '任务已提交！taskId: ' + (res.data.taskId || '处理中...'), videoTaskId: res.data.taskId });
    } catch { wx.showToast({ title:'生成失败', icon:'none' }); }
    this.setData({ loading: false });
  },

  // === 音乐 ===
  onMusicPrompt(e) { this.setData({ musicPrompt: e.detail.value }); },
  onMusicLyrics(e) { this.setData({ musicLyrics: e.detail.value }); },
  onMusicDuration(e) { this.setData({ musicDuration: parseInt(e.detail.value) || 30 }); },
  async doGenerateMusic() {
    const { musicPrompt, musicLyrics, musicDuration } = this.data;
    if (!musicPrompt.trim()) { wx.showToast({ title:'请输入音乐描述', icon:'none' }); return; }
    this.setData({ loading: true });
    try {
      const res = await api.generateMusic({ prompt: musicPrompt, lyrics: musicLyrics, duration: musicDuration });
      this.setData({ musicResult: '任务已提交！taskId: ' + (res.data.taskId || '处理中...'), musicTaskId: res.data.taskId });
    } catch { wx.showToast({ title:'生成失败', icon:'none' }); }
    this.setData({ loading: false });
  }
});
