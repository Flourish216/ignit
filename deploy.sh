#!/bin/bash
# Ignit 部署脚本 - 腾讯云轻量服务器

set -e

echo "🚀 开始部署 Ignit..."

# 1. 构建
echo "📦 构建生产版本..."
npm install
npm run build

# 2. 打包
echo "📁 打包文件..."
tar -czf ../ignit-deploy.tar.gz \
  .next/ \
  package.json \
  package-lock.json \
  public/ \
  next.config.mjs \
  .env.local 2>/dev/null || echo "⚠️  .env.local 不存在，请确保环境变量已设置"

echo "✅ 打包完成: ignit-deploy.tar.gz"
echo ""
echo "📤 上传到服务器的命令:"
echo "   scp ignit-deploy.tar.gz root@你的服务器IP:/root/"
echo ""
echo "🔧 然后在服务器上执行:"
echo "   mkdir -p /var/www/ignit"
echo "   tar -xzf ignit-deploy.tar.gz -C /var/www/ignit"
echo "   cd /var/www/ignit"
echo "   npm install --production"
echo "   npm start"
