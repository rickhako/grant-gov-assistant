#!/bin/bash

# 助成金アシスタントシステム停止スクリプト

echo "🛑 助成金アシスタントシステムを停止します..."

# MCPサーバーを停止
if [ -f /tmp/mcp-server.pid ]; then
  MCP_PID=$(cat /tmp/mcp-server.pid)
  if kill -0 $MCP_PID 2>/dev/null; then
    kill $MCP_PID
    echo "✅ MCPサーバーを停止しました (PID: $MCP_PID)"
  fi
  rm /tmp/mcp-server.pid
fi

# Next.jsアプリケーションを停止
if [ -f /tmp/nextjs.pid ]; then
  NEXT_PID=$(cat /tmp/nextjs.pid)
  if kill -0 $NEXT_PID 2>/dev/null; then
    kill $NEXT_PID
    echo "✅ Next.jsアプリケーションを停止しました (PID: $NEXT_PID)"
  fi
  rm /tmp/nextjs.pid
fi

echo "✨ すべてのサービスが停止しました"
