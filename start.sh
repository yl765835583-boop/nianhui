#!/bin/bash
echo "============================"
echo " 年会 AI 工具箱 - 部署启动"
echo "============================"

cd "$(dirname "$0")/server"

echo "[1/3] 安装依赖..."
npm install --production

echo "[2/3] 创建数据目录..."
mkdir -p data/uploads

echo "[3/3] 启动服务..."
echo ""
echo "服务地址: http://localhost:3456"
echo "投屏页:   http://localhost:3456/screen/index.html"
echo "管理后台: http://localhost:3456/admin/"
echo "手机版:   http://localhost:3456/mobile/"
echo ""
node app.js
