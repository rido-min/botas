from __future__ import annotations

from botas.bot_auth import BotAuthError, validate_bot_token


def bot_auth_dependency(app_id: str | None = None):
    """Return a FastAPI dependency that validates the Bot Framework JWT token.

    Usage:
        @app.post("/api/messages", dependencies=[Depends(bot_auth_dependency())])
        async def messages(request: Request): ...
    """
    from fastapi import Header, HTTPException

    async def _dependency(authorization: str | None = Header(default=None)) -> None:
        try:
            await validate_bot_token(authorization, app_id)
        except BotAuthError as exc:
            raise HTTPException(status_code=401, detail=str(exc)) from exc

    return _dependency


__all__ = ["bot_auth_dependency"]
