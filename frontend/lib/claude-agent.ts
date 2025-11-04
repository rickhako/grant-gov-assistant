/**
 * Claude AIエージェント
 * JグランツAPIを使用して助成金に関する質問に答える
 */

import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY || "",
});

const JGRANTS_API_BASE = "https://api.jgrants-portal.go.jp";

/**
 * JグランツAPIを呼び出す
 */
async function callJGrantsAPI(endpoint: string, params: Record<string, any>): Promise<any> {
  const url = new URL(endpoint, JGRANTS_API_BASE);
  Object.keys(params).forEach(key => {
    if (params[key] !== undefined && params[key] !== null) {
      url.searchParams.append(key, String(params[key]));
    }
  });

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Accept": "application/json",
    },
  });

  if (!response.ok) {
    throw new Error(`JグランツAPI呼び出しエラー: ${response.status} ${response.statusText}`);
  }

  return await response.json();
}

type Message = {
  role: "user" | "assistant";
  content: string;
};

/**
 * MCPツールの定義（Claude Tool Useフォーマット）
 */
const tools: Anthropic.Tool[] = [
  {
    name: "list_subsidies",
    description:
      "キーワードを指定して、応募受付中の補助金・助成金一覧を検索・取得します。Jグランツのデータベースから最新の情報を取得できます。検索結果は最大5件まで返されます。",
    input_schema: {
      type: "object",
      properties: {
        keyword: {
          type: "string",
          description: "検索キーワード（例: IT補助金、環境助成金など）",
        },
        limit: {
          type: "number",
          description: "取得件数の上限（1-5件、デフォルト: 5）。トークン制限のため5件が上限です。",
        },
      },
      required: ["keyword"],
    },
  },
  {
    name: "get_subsidy_detail",
    description:
      "補助金・助成金の詳細情報をIDを用いて取得します。応募要件、予算額、期限などの詳しい情報が得られます。",
    input_schema: {
      type: "object",
      properties: {
        subsidy_id: {
          type: "string",
          description: "補助金・助成金のID",
        },
      },
      required: ["subsidy_id"],
    },
  },
];

/**
 * Claudeとの対話を処理する
 */
export async function chatWithClaude(
  messages: Message[]
): Promise<string> {
  const systemPrompt = `あなたは日本の補助金・助成金に関する専門的なアシスタントです。
Jグランツ（デジタル庁が運営する補助金電子申請システム）のデータベースにアクセスして、
ユーザーの質問に正確に答えてください。

以下のツールを活用してください：
- list_subsidies: キーワードで補助金を検索（最大5件まで）
- get_subsidy_detail: 特定の補助金の詳細情報を取得

重要な制約：
- トークン制限のため、検索結果は最大5件までに制限されています
- 詳細情報の取得は必要最小限にしてください
- 複数の検索を行う場合は、異なるキーワードで分けて検索してください

回答する際は：
1. 丁寧で分かりやすい日本語を使用
2. 具体的な補助金名、主催団体、締切日を明記
3. 最大5件の範囲で最も関連性の高い補助金を提案
4. 応募要件や注意事項も伝える`;

  try {
    let conversationMessages: Anthropic.MessageParam[] = messages.map((msg) => ({
      role: msg.role,
      content: msg.content,
    }));

    // Claude APIに最初のリクエスト
    let response = await anthropic.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 4096,
      system: systemPrompt,
      messages: conversationMessages,
      tools: tools,
    });

    // ツール使用のループ処理
    while (response.stop_reason === "tool_use") {
      // すべてのツール呼び出しを抽出
      const toolUseBlocks = response.content.filter(
        (block): block is Anthropic.ToolUseBlock => block.type === "tool_use"
      );

      if (toolUseBlocks.length === 0) break;

      // アシスタントのレスポンスを会話履歴に追加
      conversationMessages.push({
        role: "assistant",
        content: response.content,
      });

      // すべてのツールを並列実行して結果を取得
      const toolResults = await Promise.all(
        toolUseBlocks.map(async (toolUseBlock) => {
          let toolResult: any;
          try {
            if (toolUseBlock.name === "list_subsidies") {
              const args = toolUseBlock.input as { keyword: string; limit?: number };
              // limitを最大5に制限してトークン数を抑える
              const limit = Math.min(args.limit || 5, 5);

              toolResult = await callJGrantsAPI(
                "/exp/v1/public/subsidies",
                {
                  keyword: args.keyword || "補助金",
                  sort: "created_date",
                  order: "DESC",
                  acceptance: 1,
                  limit: limit,
                }
              );

              // レスポンスを整形（必要最小限の情報のみ）
              const formatted = {
                total: toolResult?.metadata?.resultset?.count || 0,
                subsidies: (toolResult.result || []).slice(0, limit).map((item: any) => ({
                  id: item.id,
                  title: item.title,
                  organization: item.name,
                  deadline: item.acceptance_end_datetime,
                  max_limit: item.subsidy_max_limit,
                  target_area: item.target_area_search,
                  summary: (item.overview || "").substring(0, 150),
                })),
              };
              toolResult = formatted;
            } else if (toolUseBlock.name === "get_subsidy_detail") {
              const args = toolUseBlock.input as { subsidy_id: string };
              const fullDetail = await callJGrantsAPI(
                `/exp/v1/public/subsidies/id/${args.subsidy_id}`,
                {}
              );

              // 詳細情報を要約（トークン数削減）
              toolResult = {
                id: fullDetail.id,
                title: fullDetail.title,
                organization: fullDetail.name,
                purpose: (fullDetail.purpose || "").substring(0, 500),
                overview: (fullDetail.overview || "").substring(0, 500),
                target_organization: (fullDetail.target_organization || "").substring(0, 300),
                subsidy_max_limit: fullDetail.subsidy_max_limit,
                target_area_search: fullDetail.target_area_search,
                acceptance_start_datetime: fullDetail.acceptance_start_datetime,
                acceptance_end_datetime: fullDetail.acceptance_end_datetime,
                contact_information: fullDetail.contact_information,
                website_url: fullDetail.website_url,
              };
            } else {
              toolResult = { error: `Unknown tool: ${toolUseBlock.name}` };
            }
          } catch (error) {
            toolResult = { error: String(error) };
          }

          return {
            type: "tool_result" as const,
            tool_use_id: toolUseBlock.id,
            content: JSON.stringify(toolResult),
          };
        })
      );

      // すべてのツール結果を会話履歴に追加
      conversationMessages.push({
        role: "user",
        content: toolResults,
      });

      // 次のClaudeレスポンスを取得
      response = await anthropic.messages.create({
        model: "claude-sonnet-4-5-20250929",
        max_tokens: 4096,
        system: systemPrompt,
        messages: conversationMessages,
        tools: tools,
      });
    }

    // 最終的なテキストレスポンスを抽出
    const textBlock = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === "text"
    );

    return textBlock?.text || "申し訳ございません。回答を生成できませんでした。";
  } catch (error) {
    console.error("Claude API error:", error);
    throw error;
  }
}
