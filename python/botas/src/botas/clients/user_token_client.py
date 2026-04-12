from __future__ import annotations

import base64
import json
from typing import Any

from botas.clients.bot_http_client import BotHttpClient, BotRequestOptions, TokenProvider
from botas.schema.core_activity import CoreActivity, _CamelModel

_TOKEN_SERVICE_URL = "https://token.botframework.com"


class TokenStatus(_CamelModel):
    channel_id: str
    connection_name: str
    has_token: bool = False
    service_provider_display_name: str | None = None


class UserToken(_CamelModel):
    connection_name: str
    token: str
    expiration: str | None = None


class SignInResource(_CamelModel):
    sign_in_link: str
    token_exchange_resource: dict[str, Any] | None = None


class TokenExchangeRequest(_CamelModel):
    uri: str | None = None
    token: str | None = None


class UserTokenClient:
    def __init__(self, get_token: TokenProvider | None = None) -> None:
        self._http = BotHttpClient(get_token)

    async def get_token_status_async(
        self, user_id: str, channel_id: str, connection_name: str | None = None
    ) -> list[TokenStatus]:
        params: dict[str, str | None] = {
            "userId": user_id,
            "channelId": channel_id,
            "include": connection_name,
        }
        data = await self._http.get(
            _TOKEN_SERVICE_URL, "/api/usertoken/GetTokenStatus", params=params,
            options=BotRequestOptions(operation_description="get token status"),
        )
        return [TokenStatus.model_validate(t) for t in (data or [])]

    async def get_token_async(
        self,
        user_id: str,
        channel_id: str,
        connection_name: str,
        code: str | None = None,
    ) -> UserToken | None:
        params: dict[str, str | None] = {
            "userId": user_id,
            "channelId": channel_id,
            "connectionName": connection_name,
            "code": code,
        }
        data = await self._http.get(
            _TOKEN_SERVICE_URL, "/api/usertoken/GetToken", params=params,
            options=BotRequestOptions(operation_description="get token", return_none_on_not_found=True),
        )
        return UserToken.model_validate(data) if data else None

    async def get_sign_in_resource_async(
        self,
        connection_name: str,
        activity: CoreActivity,
        final_redirect: str | None = None,
    ) -> SignInResource | None:
        state = self._build_state(connection_name, activity)
        params: dict[str, str | None] = {
            "state": state,
            "finalRedirect": final_redirect,
        }
        data = await self._http.get(
            _TOKEN_SERVICE_URL, "/api/botsignin/GetSignInResource", params=params,
            options=BotRequestOptions(operation_description="get sign-in resource"),
        )
        return SignInResource.model_validate(data) if data else None

    async def exchange_token_async(
        self,
        user_id: str,
        channel_id: str,
        connection_name: str,
        request: TokenExchangeRequest,
    ) -> UserToken | None:
        params: dict[str, str | None] = {
            "userId": user_id,
            "channelId": channel_id,
            "connectionName": connection_name,
        }
        data = await self._http.post(
            _TOKEN_SERVICE_URL,
            "/api/usertoken/exchange?" + "&".join(f"{k}={v}" for k, v in params.items() if v),
            request.model_dump(by_alias=True, exclude_none=True),
            BotRequestOptions(operation_description="exchange token"),
        )
        return UserToken.model_validate(data) if data else None

    async def sign_out_user_async(
        self, user_id: str, channel_id: str, connection_name: str | None = None
    ) -> None:
        params: dict[str, str | None] = {
            "userId": user_id,
            "channelId": channel_id,
            "connectionName": connection_name,
        }
        endpoint = "/api/usertoken/SignOut"
        query = "&".join(f"{k}={v}" for k, v in params.items() if v is not None)
        if query:
            endpoint = f"{endpoint}?{query}"
        await self._http.delete(
            _TOKEN_SERVICE_URL, endpoint,
            BotRequestOptions(operation_description="sign out user"),
        )

    def _build_state(self, connection_name: str, activity: CoreActivity) -> str:
        ext = activity.model_extra or {}
        state = {
            "connectionName": connection_name,
            "conversation": {
                "id": activity.conversation.id if activity.conversation else "",
                "channelId": ext.get("channelId"),
                "serviceUrl": activity.service_url,
            },
            "relatesTo": ext.get("id"),
        }
        return base64.b64encode(json.dumps(state).encode()).decode()
