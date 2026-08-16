const api = require('../../utils/api');

Page({
  data: {
    mode: 'wenan',
    wenanType: '领导致辞',
    wenanTypes: ['领导致辞', '主持串词', '颁奖词', '抽奖话术', '员工评语', '年会标语', '对联'],
    scriptType: '小品',
    scriptTypes: ['小品', '脱口秀', '三句半', '歌词改编'],
    style: '正式大气',
    styles: ['正式大气', '幽默轻松', '温情走心'],
    topic: '',
    wordCount: 500,
    people: 3,
    duration: 5,
    song: '',
    loading: false,
    result: '',
    showResult: false,
  },

  switchMode(e) {
    this.setData({ mode: e.currentTarget.dataset.mode, result: '', showResult: false });
  },
  selectType(e) {
    this.setData({ wenanType: e.currentTarget.dataset.value });
  },
  selectScript(e) {
    this.setData({ scriptType: e.currentTarget.dataset.value });
  },
  selectStyle(e) {
    this.setData({ style: e.currentTarget.dataset.value });
  },

  onTopicInput(e) {
    this.setData({ topic: e.detail.value });
  },
  onSongInput(e) {
    this.setData({ song: e.detail.value });
  },
  onWordCount(e) {
    this.setData({ wordCount: parseInt(e.detail.value) || 500 });
  },
  onPeople(e) {
    this.setData({ people: parseInt(e.detail.value) || 3 });
  },
  onDuration(e) {
    this.setData({ duration: parseInt(e.detail.value) || 5 });
  },

  async doGenerate() {
    this.setData({ loading: true, showResult: false });
    try {
      const { mode, wenanType, scriptType, style, topic, wordCount, people, duration, song } =
        this.data;
      let res;
      if (mode === 'wenan') {
        res = await api.generateWenan({ type: wenanType, style, topic, wordCount });
      } else if (mode === 'script') {
        res = await api.generateScript({ scriptType, topic, people, duration, style });
      } else if (mode === 'lyrics') {
        res = await api.generateLyrics({ song, topic, style });
      }
      this.setData({ result: res.data.text, showResult: true });
    } catch (e) {
      wx.showToast({ title: '生成失败', icon: 'none' });
    }
    this.setData({ loading: false });
  },

  copyResult() {
    wx.setClipboardData({
      data: this.data.result,
      success: () => wx.showToast({ title: '已复制' }),
    });
  },

  async doRewrite() {
    if (!this.data.result) return;
    this.setData({ loading: true });
    try {
      const res = await api.rewriteText({ text: this.data.result, style: this.data.style });
      this.setData({ result: res.data.text });
    } catch (e) {
      wx.showToast({ title: '改写失败', icon: 'none' });
    }
    this.setData({ loading: false });
  },
});
