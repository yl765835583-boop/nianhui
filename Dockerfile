# 年会 AI 工具箱 - 微信云托管 Dockerfile
FROM node:18-alpine

WORKDIR /app

# 复制 package 文件并安装依赖
COPY server/package*.json ./server/
RUN cd server && npm install --production

# 复制全部项目文件
COPY server/ ./server/
COPY admin/ ./admin/
COPY screen/ ./screen/
COPY mobile/ ./mobile/
COPY public/ ./public/

# 创建数据目录
RUN mkdir -p server/data/uploads

# Cloudbase 默认使用 80 端口
ENV PORT=80
ENV NODE_ENV=production

WORKDIR /app/server

EXPOSE 80

CMD ["node", "app.js"]
