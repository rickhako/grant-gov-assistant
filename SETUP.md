# セットアップ完了ガイド

## ✅ システム構築完了

助成金アシスタントシステムの構築が完了しました！

## 🚀 現在の状態

### サービス起動中

以下のサービスが起動しています：

1. **JグランツMCPサーバー**
   - URL: http://127.0.0.1:8000
   - ログ: `/var/www/html/grant-gov-assistant/jgrants-mcp/mcp-server.log`
   - PIDファイル: `/tmp/mcp-server.pid`

2. **Next.js Webアプリケーション**
   - URL: http://localhost:3000
   - 外部URL: http://160.251.206.224:3000
   - ログ: `/var/www/html/grant-gov-assistant/frontend/nextjs.log`
   - PIDファイル: `/tmp/nextjs.pid`

## 🌐 アクセス方法

### ローカルアクセス
```
http://localhost:3000
```

### 外部アクセス（サーバーのIPアドレス）
```
http://160.251.206.224:3000
```

## 🎯 使い方

1. ブラウザで上記URLにアクセス
2. テキストボックスに助成金に関する質問を入力
3. 送信ボタンをクリック

### 質問例

- 「IT関連の補助金を教えて」
- 「中小企業向けの助成金はありますか？」
- 「環境分野の補助金で締切が近いものは？」
- 「東京都の事業者が応募できる補助金を探して」

## 🛠️ 管理コマンド

### サービスの停止
```bash
cd /var/www/html/grant-gov-assistant
./stop-services.sh
```

### サービスの再起動
```bash
cd /var/www/html/grant-gov-assistant
./stop-services.sh
./start-services.sh
```

### ログの確認
```bash
# MCPサーバーログ
tail -f /var/www/html/grant-gov-assistant/jgrants-mcp/mcp-server.log

# Next.jsログ
tail -f /var/www/html/grant-gov-assistant/frontend/nextjs.log
```

### プロセスの確認
```bash
# MCPサーバー
cat /tmp/mcp-server.pid
ps aux | grep $(cat /tmp/mcp-server.pid)

# Next.js
cat /tmp/nextjs.pid
ps aux | grep $(cat /tmp/nextjs.pid)
```

## 📂 ディレクトリ構成

```
/var/www/html/grant-gov-assistant/
├── jgrants-mcp/              # JグランツMCPサーバー
│   ├── server.py             # MCPサーバー本体
│   ├── requirements.txt      # Python依存関係
│   ├── venv/                # Python仮想環境
│   └── mcp-server.log       # サーバーログ
│
├── frontend/                # Next.jsアプリケーション
│   ├── app/                # App Router
│   │   ├── page.tsx        # メインページ（ChatGPT風UI）
│   │   ├── layout.tsx      # レイアウト
│   │   └── api/chat/       # チャットAPI
│   ├── lib/                # ライブラリ
│   │   ├── claude-agent.ts # Claude AIエージェント
│   │   └── mcp-client.ts   # MCPクライアント
│   ├── .env.local         # 環境変数（APIキー）
│   └── nextjs.log         # アプリログ
│
├── start-services.sh       # 起動スクリプト
├── stop-services.sh        # 停止スクリプト
├── README.md              # 詳細ドキュメント
└── SETUP.md               # このファイル
```

## 🔧 トラブルシューティング

### サービスが起動しない場合

1. **ポートが使用中**
   ```bash
   # ポート3000を使っているプロセスを確認
   lsof -i :3000

   # ポート8000を使っているプロセスを確認
   lsof -i :8000
   ```

2. **依存関係の問題**
   ```bash
   # Python依存関係の再インストール
   cd /var/www/html/grant-gov-assistant/jgrants-mcp
   source venv/bin/activate
   pip install -r requirements.txt

   # Node.js依存関係の再インストール
   cd /var/www/html/grant-gov-assistant/frontend
   npm install
   ```

3. **ビルドエラー**
   ```bash
   cd /var/www/html/grant-gov-assistant/frontend
   npm run build
   ```

### APIエラーが発生する場合

1. **Anthropic APIキーの確認**
   ```bash
   cat /var/www/html/grant-gov-assistant/frontend/.env.local
   ```

2. **MCPサーバーの接続確認**
   ```bash
   curl http://127.0.0.1:8000/sse
   ```

### ログでエラーを確認
```bash
# 最新のエラーを確認
tail -50 /var/www/html/grant-gov-assistant/jgrants-mcp/mcp-server.log
tail -50 /var/www/html/grant-gov-assistant/frontend/nextjs.log
```

## 🔐 セキュリティ

### 重要な注意事項

1. **APIキーの保護**
   - `.env.local`ファイルは外部に公開しないでください
   - Gitにコミットしないでください（.gitignoreに含まれています）

2. **ファイアウォール設定**
   - 必要に応じてポート3000へのアクセスを制限してください
   ```bash
   # UFWの例
   sudo ufw allow 3000/tcp
   ```

3. **本番環境での運用**
   - SSL/TLS証明書の設定を推奨
   - nginxなどのリバースプロキシの利用を推奨

## 📊 システム要件

- **Node.js**: 22.16.0以上
- **Python**: 3.10.12以上
- **メモリ**: 最低2GB推奨
- **ディスク**: 1GB以上の空き容量

## 📞 サポート

詳細なドキュメントは`README.md`を参照してください。

---

**構築完了日時**: 2025年10月29日
**バージョン**: 1.0.0
