"""High-level client for the Bot Service Conversation REST API.

Wraps :class:`_BotHttpClient` to provide typed methods for sending,
updating, and deleting activities, managing conversation members, and
creating conversations.
"""

from __future__ import annotations

from typing import Any, Optional, Union
from urllib.parse import quote

from botas.bot_http_client import TokenProvider, _BotHttpClient, _BotRequestOptions
from botas.core_activity import (
    ChannelAccount,
    Conversation,
    CoreActivity,
    ResourceResponse,
    _ConversationParameters,
    _ConversationResourceResponse,
    _ConversationsResult,
    _PagedMembersResult,
    _Transcript,
)
from botas.meter_provider import get_metrics
from botas.tracer_provider import get_tracer


def _encode_conversation_id(conversation_id: str) -> str:
    return quote(conversation_id, safe="")


def _encode_id(id_value: str) -> str:
    """URL-encode an ID for use in path parameters."""
    return quote(id_value, safe="")


def _serialize(obj: Any) -> Any:
    """Convert Pydantic model or plain dict to a JSON-serializable dict."""
    if hasattr(obj, "model_dump"):
        return obj.model_dump(by_alias=True, exclude_none=True)
    return obj


class ConversationClient:
    """Typed client for Bot Service Conversation REST API operations.

    All methods accept a ``service_url`` and ``conversation_id`` to target
    the correct channel endpoint.  Authentication is handled automatically
    via the injected :class:`TokenProvider`.
    """

    def __init__(self, get_token: Optional[TokenProvider] = None) -> None:
        """Initialise the conversation client.

        Args:
            get_token: Async callable that supplies a bearer token.
                When ``None``, requests are unauthenticated.
        """
        self._http = _BotHttpClient(get_token)

    async def send_activity_async(
        self,
        service_url: str,
        conversation_id: str,
        activity: Union[
            CoreActivity,
            dict[str, Any],
        ],
    ) -> Optional[ResourceResponse]:
        """Send an activity to a conversation.

        Args:
            service_url: The channel's service URL.
            conversation_id: Target conversation identifier.
            activity: Activity payload (model or dict).

        Returns:
            A :class:`ResourceResponse` with the new activity ID, or ``None``.
        """
        tracer = get_tracer()
        metrics = get_metrics()
        if metrics:
            metrics.outbound_calls.add(1, {"operation": "sendActivity"})
        if tracer:
            with tracer.start_as_current_span("botas.conversation_client") as span:
                span.set_attribute("conversation.id", conversation_id)
                span.set_attribute("activity.type", getattr(activity, "type", "") or "")
                span.set_attribute("service.url", service_url)
                try:
                    result = await self._do_send(service_url, conversation_id, activity)
                    if result:
                        span.set_attribute("activity.id", result.id or "")
                    return result
                except Exception:
                    if metrics:
                        metrics.outbound_errors.add(1, {"operation": "sendActivity"})
                    raise
        try:
            return await self._do_send(service_url, conversation_id, activity)
        except Exception:
            if metrics:
                metrics.outbound_errors.add(1, {"operation": "sendActivity"})
            raise

    async def _do_send(
        self,
        service_url: str,
        conversation_id: str,
        activity: Union[
            CoreActivity,
            dict[str, Any],
        ],
    ) -> Optional[ResourceResponse]:
        """Execute the actual HTTP POST for sending an activity."""
        endpoint = f"/v3/conversations/{_encode_conversation_id(conversation_id)}/activities"
        data = await self._http.post(
            service_url,
            endpoint,
            _serialize(activity),
            _BotRequestOptions(operation_description="send activity"),
        )
        return ResourceResponse.model_validate(data) if data else None

    async def update_activity_async(
        self,
        service_url: str,
        conversation_id: str,
        activity_id: str,
        activity: Union[
            CoreActivity,
            dict[str, Any],
        ],
    ) -> Optional[ResourceResponse]:
        """Update an existing activity in a conversation.

        Args:
            service_url: The channel's service URL.
            conversation_id: Conversation containing the activity.
            activity_id: ID of the activity to update.
            activity: Replacement activity payload.

        Returns:
            A :class:`ResourceResponse`, or ``None``.
        """
        metrics = get_metrics()
        if metrics:
            metrics.outbound_calls.add(1, {"operation": "updateActivity"})
        try:
            endpoint = (
                f"/v3/conversations/{_encode_conversation_id(conversation_id)}/activities/{_encode_id(activity_id)}"
            )
            data = await self._http.put(
                service_url,
                endpoint,
                _serialize(activity),
                _BotRequestOptions(operation_description="update activity"),
            )
            return ResourceResponse.model_validate(data) if data else None
        except Exception:
            if metrics:
                metrics.outbound_errors.add(1, {"operation": "updateActivity"})
            raise

    async def delete_activity_async(self, service_url: str, conversation_id: str, activity_id: str) -> None:
        """Delete an activity from a conversation.

        Args:
            service_url: The channel's service URL.
            conversation_id: Conversation containing the activity.
            activity_id: ID of the activity to delete.
        """
        metrics = get_metrics()
        if metrics:
            metrics.outbound_calls.add(1, {"operation": "deleteActivity"})
        try:
            endpoint = (
                f"/v3/conversations/{_encode_conversation_id(conversation_id)}/activities/{_encode_id(activity_id)}"
            )
            await self._http.delete(
                service_url,
                endpoint,
                _BotRequestOptions(operation_description="delete activity"),
            )
        except Exception:
            if metrics:
                metrics.outbound_errors.add(1, {"operation": "deleteActivity"})
            raise

    async def get_conversation_members_async(self, service_url: str, conversation_id: str) -> list[ChannelAccount]:
        """Retrieve all members of a conversation.

        Args:
            service_url: The channel's service URL.
            conversation_id: Target conversation identifier.

        Returns:
            List of :class:`ChannelAccount` objects for each member.
        """
        endpoint = f"/v3/conversations/{_encode_conversation_id(conversation_id)}/members"
        data = await self._http.get(
            service_url,
            endpoint,
            options=_BotRequestOptions(operation_description="get conversation members"),
        )
        return [ChannelAccount.model_validate(m) for m in (data or [])]

    async def get_conversation_member_async(
        self, service_url: str, conversation_id: str, member_id: str
    ) -> Optional[ChannelAccount]:
        """Retrieve a single conversation member by ID.

        Args:
            service_url: The channel's service URL.
            conversation_id: Target conversation identifier.
            member_id: The member's account ID.

        Returns:
            A :class:`ChannelAccount`, or ``None`` if the member is not found.
        """
        endpoint = f"/v3/conversations/{_encode_conversation_id(conversation_id)}/members/{_encode_id(member_id)}"
        data = await self._http.get(
            service_url,
            endpoint,
            options=_BotRequestOptions(operation_description="get conversation member", return_none_on_not_found=True),
        )
        return ChannelAccount.model_validate(data) if data else None

    async def get_conversation_paged_members_async(
        self,
        service_url: str,
        conversation_id: str,
        page_size: Optional[int] = None,
        continuation_token: Optional[str] = None,
    ) -> _PagedMembersResult:
        """Retrieve conversation members with server-side pagination.

        Args:
            service_url: The channel's service URL.
            conversation_id: Target conversation identifier.
            page_size: Maximum members per page (channel may enforce its own limit).
            continuation_token: Opaque token from a previous page to fetch the next.

        Returns:
            A :class:`_PagedMembersResult` containing members and an optional
            continuation token for the next page.
        """
        endpoint = f"/v3/conversations/{_encode_conversation_id(conversation_id)}/pagedmembers"
        params = {
            "pageSize": str(page_size) if page_size else None,
            "continuationToken": continuation_token,
        }
        data = await self._http.get(
            service_url,
            endpoint,
            params=params,
            options=_BotRequestOptions(operation_description="get paged members"),
        )
        return _PagedMembersResult.model_validate(data) if data else _PagedMembersResult()

    async def delete_conversation_member_async(self, service_url: str, conversation_id: str, member_id: str) -> None:
        """Remove a member from a conversation.

        Args:
            service_url: The channel's service URL.
            conversation_id: Target conversation identifier.
            member_id: The member's account ID.
        """
        endpoint = f"/v3/conversations/{_encode_conversation_id(conversation_id)}/members/{_encode_id(member_id)}"
        await self._http.delete(
            service_url,
            endpoint,
            _BotRequestOptions(operation_description="delete conversation member"),
        )

    async def create_conversation_async(
        self, service_url: str, parameters: _ConversationParameters
    ) -> Optional[_ConversationResourceResponse]:
        """Create a new conversation on the channel.

        Args:
            service_url: The channel's service URL.
            parameters: Conversation creation parameters (members, topic, etc.).

        Returns:
            A :class:`_ConversationResourceResponse` with the new conversation
            ID and service URL, or ``None``.
        """
        data = await self._http.post(
            service_url,
            "/v3/conversations",
            _serialize(parameters),
            _BotRequestOptions(operation_description="create conversation"),
        )
        return _ConversationResourceResponse.model_validate(data) if data else None

    async def get_conversations_async(
        self, service_url: str, continuation_token: Optional[str] = None
    ) -> _ConversationsResult:
        """List conversations the bot has participated in.

        Args:
            service_url: The channel's service URL.
            continuation_token: Opaque token from a previous page.

        Returns:
            A :class:`_ConversationsResult` with conversations and an optional
            continuation token.
        """
        params = {"continuationToken": continuation_token}
        data = await self._http.get(
            service_url,
            "/v3/conversations",
            params=params,
            options=_BotRequestOptions(operation_description="get conversations"),
        )
        return _ConversationsResult.model_validate(data) if data else _ConversationsResult()

    async def send_conversation_history_async(
        self, service_url: str, conversation_id: str, _Transcript: _Transcript
    ) -> Optional[ResourceResponse]:
        """Upload a _Transcript of activities to a conversation's history.

        Args:
            service_url: The channel's service URL.
            conversation_id: Target conversation identifier.
            _Transcript: A :class:`_Transcript` containing activities to upload.

        Returns:
            A :class:`ResourceResponse`, or ``None``.
        """
        endpoint = f"/v3/conversations/{_encode_conversation_id(conversation_id)}/activities/history"
        data = await self._http.post(
            service_url,
            endpoint,
            _serialize(_Transcript),
            _BotRequestOptions(operation_description="send conversation history"),
        )
        return ResourceResponse.model_validate(data) if data else None

    async def get_conversation_account_async(self, service_url: str, conversation_id: str) -> Optional[Conversation]:
        """Retrieve the conversation account details.

        Args:
            service_url: The channel's service URL.
            conversation_id: Target conversation identifier.

        Returns:
            A :class:`Conversation` object, or ``None`` if not found.
        """
        endpoint = f"/v3/conversations/{_encode_conversation_id(conversation_id)}"
        data = await self._http.get(
            service_url,
            endpoint,
            options=_BotRequestOptions(operation_description="get conversation", return_none_on_not_found=True),
        )
        return Conversation.model_validate(data) if data else None

    async def aclose(self) -> None:
        """Close the underlying HTTP client and release resources."""
        await self._http.aclose()
