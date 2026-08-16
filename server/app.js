const express = require('express');
const cors = require('cors');
const path = require('path');
const config = require('./config');

const app = express();

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/screen', express.static(path.join(__dirname, '..', 'screen')));
app.use('/admin', express.static(path.join(__dirname, '..', 'admin')));
app.use(
  '/mobile',
  express.static(path.join(__dirname, '..', 'mobile'), {
    setHeaders: (res) => {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.set('Pragma', 'no-cache');
    },
  })
);
app.use('/uploads', express.static(config.upload.dir));

app.use(require('./middleware/auth'));
app.use(require('./middleware/rateLimit'));

app.use('/api/wenan', require('./routes/wenan'));
app.use('/api/avatar', require('./routes/avatar'));
app.use('/api/wall', require('./routes/wall'));
app.use('/api/lottery', require('./routes/lottery'));
app.use('/api/game', require('./routes/game'));
app.use('/api/video', require('./routes/video'));
app.use('/api/music', require('./routes/music'));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/settings', require('./routes/settings'));
app.use('/api/redpacket', require('./routes/redpacket'));
app.use('/api/signin', require('./routes/signin'));
app.use('/api/qrcode', require('./routes/qrcode'));
app.use('/api/wechat', require('./routes/wechat'));

app.get('/api/health', (req, res) => {
  res.json({ code: 0, data: { status: 'ok', time: Date.now() } });
});

const http = require('http');
const server = http.createServer(app);
const ws = require('./services/socket');
ws.init(server);

server.listen(config.port, () => {
  console.log('年会 AI 工具箱后端已启动: http://localhost:' + config.port);
  console.log('投屏页: http://localhost:' + config.port + '/screen/wall.html');
  console.log('管理后台: http://localhost:' + config.port + '/admin/');
});
