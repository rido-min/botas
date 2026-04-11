from __future__ import annotations
from typing import Any
from urllib.parse import quote

from botas.clients.bot_http_client import BotHttpClient, BotRequestOptions, TokenProvider
from botas.schema.activity import (
    Activity,
    ChannelAccount,
    ConversationAccount,
    ConversationParameters,
    ConversationResourceResponse,
    ConversationsResult,
    PagedMembersResult,
    ResourceResponse,
    Transcript,
)


def _encode_conversation_id(conversation_id: str) -> str:
    truncated = conversation_id.split(";")[0]
    return quote(truncated, safe="")


def _serialize(obj: Any) -> Any:
    """Convert Pydantic model or plain dict to a JSON-serializable dict."""
    if hasattr(obj, "model_dump"):
        return obj.model_dump(by_alias=True, exclude_none=True)
    return obj


class ConversationClient:
    def __init__(self, get_token: TokenProvider | None = None) -> None:
        self._http = BotHttpClient(get_token)

    async def send_activity_async(
        self,
        service_url: str,
        conversation_id: str,
        activity: Activity | dict[str, Any],
    ) -> ResourceResponse | None:
        endpoint = f"/v3/conversations/{_encode_conversation_id(conversation_id)}/activities"
        data = await self._http.post(
            service_url, endpoint, _serialize(activity),
            BotRequestOptions(operation_description="send activity"),
        )
        return ResourceResponse.model_validate(data) if data else None

    async def update_activity_async(
        self,
        service_url: str,
        conversation_id: str,
        activity_id: str,
        activity: Activity | dict[str, Any],
    ) -> ResourceResponse | None:
        endpoint = f"/v3/conversations/{_encode_conversation_id(conversation_id)}/activities/{activity_id}"
        data = await self._http.put(
            service_url, endpoint, _serialize(activity),
            BotRequestOptions(operation_description="update activity"),
        )
        return ResourceResponse.model_validate(data) if data else None

    async def delete_activity_async(
        self, service_url: str, conversation_id: str, activity_id: str
    ) -> None:
        endpoint = f"/v3/conversations/{_encode_conversation_id(conversation_id)}/activities/{activity_id}"
        await self._http.delete(
            service_url, endpoint,
            BotRequestOptions(operation_description="delete activity"),
        )

    async def get_conversation_members_async(
        self, service_url: str, conversation_id: str
    ) -> list[ChannelAccount]:
        endpoint = f"/v3/conversations/{_encode_conversation_id(conversation_id)}/members"
        data = await self._http.get(
            service_url, endpoint, options=BotRequestOptions(operation_description="get conversation members"),
        )
        return [ChannelAccount.model_validate(m) for m in (data or [])]

    async def get_conversation_member_async(
        self, service_url: str, conversation_id: str, member_id: str
    ) -> ChannelAccount | None:
        endpoint = f"/v3/conversations/{_encode_conversation_id(conversation_id)}/members/{member_id}"
        data = await self._http.get(
            service_url, endpoint,
            options=BotRequestOptions(operation_description="get conversation member", return_none_on_not_found=True),
        )
        return ChannelAccount.model_validate(data) if data else None

    async def get_conversation_paged_members_async(
        self,
        service_url: str,
        conversation_id: str,
        page_size: int | None = None,
        continuation_token: str | None = None,
    ) -> PagedMembersResult:
        endpoint = f"/v3/conversations/{_encode_conversation_id(conversation_id)}/pagedmembers"
        params = {
            "pageSize": str(page_size) if page_size else None,
            "continuationToken": continuation_token,
        }
        data = await self._http.get(
            service_url, endpoint, params=params,
            options=BotRequestOptions(operation_description="get paged members"),
        )
        return PagedMembersResult.model_validate(data) if data else PagedMembersResult()

    async def delete_conversation_member_async(
        self, service_url: str, conversation_id: str, member_id: str
    ) -> None:
        endpoint = f"/v3/conversations/{_encode_conversation_id(conversation_id)}/members/{member_id}"
        await self._http.delete(
            service_url, endpoint,
            BotRequestOptions(operation_description="delete conversation member"),
        )

    async def create_conversation_async(
        self, service_url: str, parameters: ConversationParameters
    ) -> ConversationResourceResponse | None:
        data = await self._http.post(
            service_url, "/v3/conversations", _serialize(parameters),
            BotRequestOptions(operation_description="create conversation"),
        )
        return ConversationResourceResponse.model_validate(data) if data else None

    async def get_conversations_async(
        self, service_url: str, continuation_token: str | None = None
    ) -> ConversationsResult:
        params = {"continuationToken": continuation_token}
        data = await self._http.get(
            service_url, "/v3/conversations", params=params,
            options=BotRequestOptions(operation_description="get conversations"),
        )
        return ConversationsResult.model_validate(data) if data else ConversationsResult()

    async def send_conversation_history_async(
        self, service_url: str, conversation_id: str, transcript: Transcript
    ) -> ResourceResponse | None:
        endpoint = f"/v3/conversations/{_encode_conversation_id(conversation_id)}/activities/history"
        data = await self._http.post(
            service_url, endpoint, _serialize(transcript),
            BotRequestOptions(operation_description="send conversation history"),
        )
        return ResourceResponse.model_validate(data) if data else None

    async def get_conversation_account_async(
        self, service_url: str, conversation_id: str
    ) -> ConversationAccount | None:
        endpoint = f"/v3/conversations/{_encode_conversation_id(conversation_id)}"
        data = await self._http.get(
            service_url, endpoint,
            options=BotRequestOptions(operation_description="get conversation", return_none_on_not_found=True),
        )
        return ConversationAccount.model_validate(data) if data else None
