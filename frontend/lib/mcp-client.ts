/**
 * MCP（Model Context Protocol）クライアント
 * JグランツMCPサーバーと通信するためのクライアント
 */

import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { SSEClientTransport } from "@modelcontextprotocol/sdk/client/sse.js";

export interface SubsidySearchResult {
  total: number;
  subsidies: Array<{
    id: string;
    title: string;
    organization: string;
    deadline: string;
    summary: string;
  }>;
}

export interface SubsidyDetail {
  id: string;
  title: string;
  organization_name: string;
  summary: string;
  application_deadline: string;
  budget_amount?: string;
  eligibility?: string;
  attachments?: Array<{
    name: string;
    download_url: string;
  }>;
}

let mcpClient: Client | null = null;

/**
 * MCPクライアントの初期化（シングルトン）
 */
async function getMCPClient(): Promise<Client> {
  if (mcpClient) {
    return mcpClient;
  }

  const MCP_SERVER_URL = process.env.MCP_SERVER_URL || "http://127.0.0.1:8000";

  const client = new Client(
    {
      name: "grant-assistant-client",
      version: "1.0.0",
    },
    {
      capabilities: {},
    }
  );

  const transport = new SSEClientTransport(new URL(`${MCP_SERVER_URL}/sse`));

  await client.connect(transport);
  mcpClient = client;

  return client;
}

/**
 * MCPサーバーのツールを呼び出す
 */
async function callMCPTool(
  toolName: string,
  args: Record<string, any>
): Promise<any> {
  try {
    const client = await getMCPClient();

    const result = await client.callTool({
      name: toolName,
      arguments: args,
    });

    // MCPのレスポンスからコンテンツを抽出
    if (result.content && Array.isArray(result.content)) {
      const textContent = result.content.find((c: any) => c.type === "text");
      if (textContent && textContent.text) {
        return JSON.parse(textContent.text);
      }
    }

    return result;
  } catch (error) {
    console.error(`Error calling MCP tool ${toolName}:`, error);
    throw error;
  }
}

/**
 * 補助金を検索する
 */
export async function searchSubsidies(
  keyword: string = "補助金",
  limit: number = 10
): Promise<SubsidySearchResult> {
  return callMCPTool("list_subsidies", { keyword, limit });
}

/**
 * 補助金の詳細を取得する
 */
export async function getSubsidyDetail(
  subsidyId: string
): Promise<SubsidyDetail> {
  return callMCPTool("get_subsidy_detail", { subsidy_id: subsidyId });
}

/**
 * 添付ファイルのダウンロードURL取得
 */
export async function getAttachmentUrl(
  subsidyId: string,
  attachmentIndex: number
): Promise<{ download_url: string }> {
  return callMCPTool("download_attachment", {
    subsidy_id: subsidyId,
    attachment_index: attachmentIndex,
  });
}
