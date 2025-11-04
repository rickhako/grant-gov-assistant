"""
JグランツMCPサーバー
デジタル庁が運営する補助金電子申請システムの公開APIを利用したMCPサーバー
"""

from fastmcp import FastMCP
import httpx
from typing import Optional

# MCPサーバーの初期化
mcp = FastMCP("Jグランツ補助金検索")

# JグランツAPIのベースURL
JGRANTS_API_BASE = "https://api.jgrants-portal.go.jp"


@mcp.tool()
async def list_subsidies(keyword: str = "補助金", limit: int = 10) -> dict:
    """
    キーワードを指定して、応募受付中の補助金一覧を検索・取得します

    Args:
        keyword: 検索キーワード（デフォルト: "補助金"）
        limit: 取得件数の上限（デフォルト: 10）

    Returns:
        補助金一覧のデータ
    """
    async with httpx.AsyncClient() as client:
        try:
            # JグランツAPI呼び出し（公募情報検索）
            response = await client.get(
                f"{JGRANTS_API_BASE}/exp/v1/public/subsidies",
                params={
                    "keyword": keyword,
                    "sort": "created_date",
                    "order": "DESC",
                    "acceptance": 1,  # 募集中のみ
                    "limit": limit
                },
                timeout=30.0
            )
            response.raise_for_status()
            data = response.json()

            # レスポンスを整形
            result = {
                "total": data.get("count", 0),
                "subsidies": []
            }

            for item in data.get("data", []):
                result["subsidies"].append({
                    "id": item.get("subsidyId"),
                    "title": item.get("subsidyName"),
                    "organization": item.get("corporationName"),
                    "deadline": item.get("acceptanceEndDatetime"),
                    "summary": item.get("purpose", "")[:200]  # 要約は200文字まで
                })

            return result

        except httpx.HTTPError as e:
            return {"error": f"API呼び出しエラー: {str(e)}"}


@mcp.tool()
async def get_subsidy_detail(subsidy_id: str) -> dict:
    """
    補助金の詳細情報を補助金IDを用いて取得します

    Args:
        subsidy_id: 補助金ID

    Returns:
        補助金の詳細情報（base64添付ファイルデータは除外し、ダウンロードURLに置換）
    """
    async with httpx.AsyncClient() as client:
        try:
            response = await client.get(
                f"{JGRANTS_API_BASE}/exp/v1/public/subsidies/id/{subsidy_id}",
                timeout=30.0
            )
            response.raise_for_status()
            data = response.json()

            # 大きなbase64データを除外してURLに置換
            if "attachments" in data:
                for i, attachment in enumerate(data["attachments"]):
                    if "data" in attachment:
                        # base64データを削除してダウンロードURLに置換
                        attachment["data"] = None
                        attachment["download_url"] = f"{JGRANTS_API_BASE}/exp/v1/public/subsidies/id/{subsidy_id}/attachments/{i}"

            return data

        except httpx.HTTPError as e:
            return {"error": f"API呼び出しエラー: {str(e)}"}


@mcp.tool()
async def download_attachment(subsidy_id: str, attachment_index: int) -> dict:
    """
    指定した補助金の添付ファイルのダウンロードURLを返します

    Args:
        subsidy_id: 補助金ID
        attachment_index: 添付ファイルのインデックス（0始まり）

    Returns:
        ダウンロードURL情報
    """
    return {
        "subsidy_id": subsidy_id,
        "attachment_index": attachment_index,
        "download_url": f"{JGRANTS_API_BASE}/exp/v1/public/subsidies/id/{subsidy_id}/attachments/{attachment_index}",
        "note": "このURLから直接ファイルをダウンロードできます"
    }


if __name__ == "__main__":
    # MCPサーバーを起動（SSE経由でHTTPサーバーとして動作）
    mcp.run(transport="sse")
