const fs = require('fs');
const path = require('path');
const { readJSON, writeJSON } = require('../utils/helpers');

const DATA_DIR = path.join(__dirname, '..', 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const files = {
  messages: path.join(DATA_DIR, 'messages.json'),
  lottery: path.join(DATA_DIR, 'lottery.json'),
  game: path.join(DATA_DIR, 'game.json'),
  avatar: path.join(DATA_DIR, 'avatar.json'),
  settings: path.join(DATA_DIR, 'settings.json'),
  drawn: path.join(DATA_DIR, 'drawn.json'),
};

// 留言墙
function getMessages() {
  return readJSON(files.messages, []);
}
function addMessage(msg) {
  const msgs = getMessages();
  const item = { ...msg, id: Date.now().toString(36), time: new Date().toISOString(), likes: 0 };
  msgs.push(item);
  writeJSON(files.messages, msgs);
  return item;
}
function likeMessage(id) {
  const msgs = getMessages();
  const msg = msgs.find((m) => m.id === id);
  if (msg) msg.likes = (msg.likes || 0) + 1;
  writeJSON(files.messages, msgs);
  return msg;
}

// 抽奖
function getLottery() {
  return readJSON(files.lottery, { prizes: [], winners: [], pool: [], blacklist: [], drawn: [] });
}
function saveLottery(data) {
  writeJSON(files.lottery, data);
}

// 游戏
function getGame() {
  return readJSON(files.game, { scores: {} });
}
function saveGame(data) {
  writeJSON(files.game, data);
}

// 头像
function getAvatars() {
  return readJSON(files.avatar, []);
}
function addAvatar(record) {
  const records = getAvatars();
  const item = { ...record, id: Date.now().toString(36), time: new Date().toISOString() };
  records.push(item);
  writeJSON(files.avatar, records);
  return item;
}

// 设置
function getSettings() {
  return readJSON(files.settings, {
    features: { wenan: true, avatar: true, wall: true, lottery: true, game: true },
  });
}
function getDrawnMessages() {
  return readJSON(files.drawn, []);
}
function saveDrawnMessages(ids) {
  writeJSON(files.drawn, ids);
}

function saveSettings(s) {
  writeJSON(files.settings, s);
}

module.exports = {
  getDrawnMessages,
  saveDrawnMessages,
  getMessages,
  addMessage,
  likeMessage,
  getLottery,
  saveLottery,
  getGame,
  saveGame,
  getAvatars,
  addAvatar,
  getSettings,
  saveSettings,
};
