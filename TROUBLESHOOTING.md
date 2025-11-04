# トラブルシューティングガイド

## 🔍 主な修正事項

このシステムで発生した問題と解決方法を記録します。

### 問題5: トークン制限超過エラー (400 Bad Request - prompt too long)

**エラーメッセージ:**
```
Error: 400 {"type":"error","error":{"type":"invalid_request_error","message":"prompt is too long: 213787 tokens > 200000 maximum"}}
```

**原因:**
- JグランツAPIから大量のデータを取得し、そのままJSON文字列としてClaudeに渡していた
- 検索結果のデフォルトlimitが10件で、各結果に大量のフィールドが含まれていた
- 詳細情報取得時に全データをそのまま返していた
- 複数回のツール呼び出しで会話履歴が膨大になった

**解決方法:**

**1. 検索結果の件数制限:**
```typescript
// limitを最大5件に制限
const limit = Math.min(args.limit || 5, 5);
```

**2. レスポンスデータの要約:**
```typescript
// 必要最小限のフィールドのみ抽出
subsidies: (toolResult.result || []).slice(0, limit).map((item: any) => ({
  id: item.id,
  title: item.title,
  organization: item.name,
  deadline: item.acceptance_end_datetime,
  max_limit: item.subsidy_max_limit,
  target_area: item.target_area_search,
  summary: (item.overview || "").substring(0, 150), // 150文字に制限
}))
```

**3. 詳細情報の要約:**
```typescript
// 詳細情報も主要フィールドのみ抽出し、長文は切り詰める
toolResult = {
  id: fullDetail.id,
  title: fullDetail.title,
  purpose: (fullDetail.purpose || "").substring(0, 500),
  overview: (fullDetail.overview || "").substring(0, 500),
  // 必要最小限のフィールドのみ
};
```

**4. システムプロンプトでの制約明示:**
```
重要な制約：
- トークン制限のため、検索結果は最大5件までに制限されています
- 詳細情報の取得は必要最小限にしてください
```

### 問題0: 複数ツール呼び出し時の tool_result エラー (400 Bad Request)

**エラーメッセージ:**
```
Error: 400 {"type":"error","error":{"type":"invalid_request_error","message":"messages.4: `tool_use` ids were found without `tool_result` blocks immediately after"}}
```

**原因:**
- Claudeが複数のツールを1度に呼び出した場合に、最初の1つしか処理していなかった
- 残りのツール呼び出しに対する`tool_result`が返されず、Claudeがエラーを返していた

**解決方法:**
`frontend/lib/claude-agent.ts`で複数ツール対応に修正：

```typescript
// 修正前：最初の1つのツールだけ処理
const toolUseBlock = response.content.find(...)
// ツール1つだけ実行
// tool_result 1つだけ返す

// 修正後：すべてのツールを処理
const toolUseBlocks = response.content.filter(...)
// すべてのツールを並列実行
const toolResults = await Promise.all(toolUseBlocks.map(...))
// すべてのtool_resultを返す
```

### 問題1: Claudeモデル名エラー (404 Not Found)

**エラーメッセージ:**
```
Error: 404 {"type":"error","error":{"type":"not_found_error","message":"model: claude-3-5-sonnet-20241022"}}
```

**原因:**
- 古いモデル名`claude-3-5-sonnet-20241022`を使用していた
- 2025年10月時点では、Claude Sonnet 4.5が最新モデル

**解決方法:**
`frontend/lib/claude-agent.ts` の91行目と140行目のモデル名を修正：

```typescript
// 修正前
model: "claude-3-5-sonnet-20241022"

// 修正後
model: "claude-sonnet-4-5-20250929"
```

### 問題2: JグランツAPI URL/パラメータの不一致

**原因:**
- APIのベースURLが間違っていた: `https://api.jgrants.go.jp`
- APIエンドポイントとパラメータが公式仕様と異なっていた

**解決方法:**
`jgrants-mcp/server.py` を修正：

**1. ベースURL修正:**
```python
# 修正前
JGRANTS_API_BASE = "https://api.jgrants.go.jp"

# 修正後
JGRANTS_API_BASE = "https://api.jgrants-portal.go.jp"
```

**2. エンドポイントとパラメータ修正:**

```python
# 補助金一覧取得
# 修正前
f"{JGRANTS_API_BASE}/exp/v1/public_offerings"
params={"keyword": keyword, "status": "accepting", "limit": limit}

# 修正後
f"{JGRANTS_API_BASE}/exp/v1/public/subsidies"
params={"keyword": keyword, "sort": "created_date", "order": "DESC", "acceptance": 1, "limit": limit}
```

**3. レスポンス構造の修正:**
```python
# 修正前
data.get("total", 0)
data.get("items", [])
item.get("id")
item.get("title")

# 修正後
data.get("count", 0)
data.get("data", [])
item.get("subsidyId")
item.get("subsidyName")
```

### 問題3: JグランツAPIレスポンス構造の誤解

**原因:**
- APIレスポンスの構造を間違って解釈していた
- 実際: `result[]`, `metadata.resultset.count`
- 想定: `data[]`, `count`

**解決方法:**
実際のAPIをテストして正しい構造を確認：

```bash
# APIテスト
python3 -c "import requests; print(requests.get('https://api.jgrants-portal.go.jp/exp/v1/public/subsidies?keyword=福祉&sort=created_date&order=DESC&acceptance=1').json())"
```

レスポンス構造を修正：
```typescript
// 修正前
total: toolResult.count || 0,
subsidies: (toolResult.data || []).map((item: any) => ({
  id: item.subsidyId,
  title: item.subsidyName,
  ...
}))

// 修正後
total: toolResult?.metadata?.resultset?.count || 0,
subsidies: (toolResult.result || []).map((item: any) => ({
  id: item.id,
  title: item.title,
  ...
}))
```

### 問題4: MCPサーバー経由の通信の複雑さ

**原因:**
- FastMCPはSSE（Server-Sent Events）で通信するが、通常のHTTP POSTで実装していた
- `@modelcontextprotocol/sdk`を使用する必要があった

**解決方法:**
`frontend/lib/claude-agent.ts` を修正して直接API呼び出しに変更：

**1. JグランツAPIを直接呼び出す関数を追加:**
```typescript
const JGRANTS_API_BASE = "https://api.jgrants-portal.go.jp";

async function callJGrantsAPI(endpoint: string, params: Record<string, any>): Promise<any> {
  const url = new URL(endpoint, JGRANTS_API_BASE);
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== null) {
      url.searchParams.append(key, String(params[key]));
    }
  });

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: { "Accept": "application/json" },
  });

  if (!response.ok) {
    throw new Error(`JグランツAPI呼び出しエラー: ${response.status}`);
  }

  return await response.json();
}
```

**2. ClaudeのTool Use内で直接APIを呼び出し:**
```typescript
if (toolUseBlock.name === "list_subsidies") {
  const args = toolUseBlock.input as { keyword: string; limit?: number };
  toolResult = await callJGrantsAPI("/exp/v1/public/subsidies", {
    keyword: args.keyword || "補助金",
    sort: "created_date",
    order: "DESC",
    acceptance: 1,
    limit: args.limit || 10,
  });
}
```

**メリット:**
- MCPサーバーの複雑な通信を回避
- Next.jsのサーバーサイドで直接APIを呼び出せる
- デバッグが容易
- レスポンスタイムの改善

## 🧪 テスト方法

### 1. MCPサーバーの動作確認

```bash
# サーバーログを確認
tail -f jgrants-mcp/mcp-server.log

# MCPサーバーが起動していることを確認
curl http://127.0.0.1:8000/sse
```

### 2. JグランツAPIの直接テスト

```bash
# 補助金一覧を取得
curl "https://api.jgrants-portal.go.jp/exp/v1/public/subsidies?keyword=補助金&sort=created_date&order=DESC&acceptance=1&limit=5"
```

### 3. Claudeモデルの確認

```bash
# Anthropic APIで利用可能なモデルを確認
curl https://api.anthropic.com/v1/models \
  -H "x-api-key: YOUR_API_KEY"
```

### 4. エンドツーエンドテスト

ブラウザで http://localhost:3000 にアクセスして以下を試す：

1. 「IT補助金を教えて」と質問
2. 「環境分野の助成金は？」と質問
3. 「北海道札幌市でエアコンを買う場合の助成金」と質問

## 📝 デバッグ手順

### ステップ1: ログの確認

```bash
# Next.jsのエラーログ
tail -100 frontend/nextjs.log | grep -i error

# MCPサーバーのログ
tail -100 jgrants-mcp/mcp-server.log
```

### ステップ2: サービスの再起動

```bash
cd /var/www/html/grant-gov-assistant
./stop-services.sh
./start-services.sh
```

### ステップ3: 再ビルド

```bash
cd /var/www/html/grant-gov-assistant/frontend
npm run build
```

### ステップ4: APIキーの確認

```bash
# 環境変数が正しく設定されているか確認
cat frontend/.env.local

# APIキーが有効か確認
curl https://api.anthropic.com/v1/messages \
  -H "content-type: application/json" \
  -H "x-api-key: $ANTHROPIC_API_KEY" \
  -H "anthropic-version: 2023-06-01" \
  -d '{"model": "claude-sonnet-4-5-20250929", "max_tokens": 10, "messages": [{"role": "user", "content": "test"}]}'
```

## 🔗 参考リソース

- [Claude API Models](https://docs.claude.com/en/docs/about-claude/models/overview)
- [JグランツAPI仕様](https://developers.digital.go.jp/documents/jgrants/api/)
- [FastMCP Documentation](https://gofastmcp.com/)
- [MCP SDK Documentation](https://modelcontextprotocol.io/)

## 💡 今後の改善点

1. **エラーハンドリングの強化**
   - ユーザーフレンドリーなエラーメッセージ
   - リトライロジックの実装

2. **キャッシュの実装**
   - MCPクライアントの接続キャッシュ
   - API結果のキャッシュ

3. **ロギングの改善**
   - 構造化ログ
   - ログレベルの設定

4. **監視とアラート**
   - ヘルスチェックエンドポイント
   - パフォーマンスモニタリング
