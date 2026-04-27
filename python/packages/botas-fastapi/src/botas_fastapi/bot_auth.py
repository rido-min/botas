from __future__ import annotations

import logging
from typing import Optional

from botas.bot_auth import BotAuthError, validate_bot_token

_logger = logging.getLogger(__name__)


class AuthFailedResponse(Exception):
    """Raised internally to signal a 401 that bot_app converts to JSONResponse."""

    def __init__(self, message: str) -> None:
        self.message = message
        super().__init__(message)


def bot_auth_dependency(app_id: Optional[str]= None):
    """Return a FastAPI dependency that validates the Bot Service JWT token.

    Usage:
        @app.post("/api/messages", dependencies=[Depends(bot_auth_dependency())])
        async def messages(request: Request): ...
    """
    from fastapi import Header

    async def _dependency(authorization: Optional[str]= Header(default=None)) -> None:
        try:
            await validate_bot_token(authorization, app_id)
        except BotAuthError as exc:
            _logger.warning("Auth failed: %s", exc)
            raise AuthFailedResponse(str(exc)) from exc

    return _dependency


__all__ = ["AuthFailedResponse", "bot_auth_dependency"]
