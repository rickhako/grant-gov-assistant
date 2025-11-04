#!/bin/bash

# 助成金アシスタントシステム起動スクリプト

set -e

echo "🚀 助成金アシスタントシステムを起動します..."

# JグランツMCPサーバーを起動
echo "📡 JグランツMCPサーバーを起動中..."
cd /var/www/html/grant-gov-assistant/jgrants-mcp
source venv/bin/activate
nohup python server.py > mcp-server.log 2>&1 &
MCP_PID=$!
echo "✅ MCPサーバー起動完了 (PID: $MCP_PID)"
echo $MCP_PID > /tmp/mcp-server.pid

# MCPサーバーが起動するまで待機
sleep 3

# Next.jsアプリケーションを起動
echo "🌐 Next.jsアプリケーションを起動中..."
cd /var/www/html/grant-gov-assistant/frontend
nohup npm run start > nextjs.log 2>&1 &
NEXT_PID=$!
echo "✅ Next.jsアプリケーション起動完了 (PID: $NEXT_PID)"
echo $NEXT_PID > /tmp/nextjs.pid

echo ""
echo "✨ すべてのサービスが起動しました！"
echo ""
echo "📊 アクセス情報:"
echo "  - Webアプリ: http://localhost:3000"
echo "  - MCPサーバー: http://localhost:8000"
echo ""
echo "📝 ログファイル:"
echo "  - MCP: /var/www/html/grant-gov-assistant/jgrants-mcp/mcp-server.log"
echo "  - Next.js: /var/www/html/grant-gov-assistant/frontend/nextjs.log"
echo ""
echo "🛑 停止するには: ./stop-services.sh"
