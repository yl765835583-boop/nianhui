// WebSocket 服务 —— 替代轮询，实时推送事件到所有客户端
let io = null;

function init(server) {
  io = require('socket.io')(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });
  io.on('connection', (socket) => {
    console.log('[WS] 客户端连接: ' + socket.id);
    socket.on('disconnect', () => {
      console.log('[WS] 客户端断开: ' + socket.id);
    });
  });
  console.log('[WS] Socket.IO 已就绪');
  return io;
}

function getIO() {
  return io;
}

// 便捷 emit 方法
function emit(event, data) {
  if (io) io.emit(event, data);
}

module.exports = { init, getIO, emit };
