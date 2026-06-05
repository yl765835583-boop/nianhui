const { io } = require('socket.io-client');
const socket = io('http://localhost:3456');

socket.on('connect', () => {
  console.log('✅ WebSocket 已连接, id=' + socket.id);
});

socket.on('redpacket:start', (data) => {
  console.log('🎯 收到 redpacket:start! count=' + data.count + ', duration=' + data.duration);
  process.exit(0);
});

socket.on('redpacket:claimed', (data) => {
  console.log('🎉 claimed: ' + data.nickname + ' ¥' + data.amount);
});

// 等连接建立后触发红包雨
setTimeout(async () => {
  console.log('📡 发送 redpacket start 请求...');
  const res = await fetch('http://localhost:3456/api/redpacket/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ count: 5, duration: 5 })
  });
  const data = await res.json();
  console.log('📡 API 返回: code=' + data.code + ', count=' + (data.data ? data.data.count : '?'));
}, 500);

// 5秒超时
setTimeout(() => {
  console.log('❌ 超时：未收到 redpacket:start 事件');
  process.exit(1);
}, 6000);
