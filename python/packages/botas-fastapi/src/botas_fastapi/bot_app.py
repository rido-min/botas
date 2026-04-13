"""Zero-boilerplate bot host using FastAPI + Uvicorn.

Example::

    from botas_fastapi import BotApp

    app = BotApp()

    @app.on("message")
    async def on_message(ctx):
        await ctx.send(f"You said: {ctx.activity.text}")

    app.start()
"""

# NOTE: Do NOT use `from __future__ import annotations` here — it breaks
# FastAPI's runtime inspection of endpoint parameter type hints (Request).

import os
from typing import Any, Awaitable, Callable

from botas.bot_application import BotApplication
from botas.core_activity import CoreActivity, ResourceResponse
from botas.i_turn_middleware import ITurnMiddleware
from botas.token_manager import BotApplicationOptions
from botas.turn_context import TurnContext

from botas_fastapi.bot_auth import bot_auth_dependency

ActivityHandler = Callable[[TurnContext], Awaitable[None]]


class BotApp:
    """Composes a :class:`BotApplication` with a FastAPI server.

    Provides ``on()``, ``use()``, and ``start()`` so a bot can be created
    and running in just a few lines of code.
    """

    def __init__(
        self,
        options: BotApplicationOptions = BotApplicationOptions(),
        *,
        port: int | None = None,
        path: str = "/api/messages",
        auth: bool | None = None,
    ) -> None:
        self.bot = BotApplication(options)
        self._port = port
        self._path = path
        self._auth = auth

    def on(
        self,
        type: str,
        handler: "ActivityHandler | None" = None,
    ) -> Any:
        """Register a handler for an activity type.

        Works as a decorator or a two-argument call — delegates to
        :meth:`BotApplication.on`.
        """
        return self.bot.on(type, handler)

    def use(self, middleware: ITurnMiddleware) -> "BotApp":
        """Register a middleware in the turn pipeline."""
        self.bot.use(middleware)
        return self

    async def send_activity_async(
        self,
        service_url: str,
        conversation_id: str,
        activity: "CoreActivity | dict[str, Any]",
    ) -> "ResourceResponse | None":
        """Proactively send an activity to a conversation."""
        return await self.bot.send_activity_async(service_url, conversation_id, activity)

    def _build_app(self) -> Any:
        """Build and return the FastAPI application (without starting it)."""
        from fastapi import Depends, FastAPI, Request  # noqa: F811

        auth_enabled = self._auth if self._auth is not None else bool(self.bot.appid)
        deps = [Depends(bot_auth_dependency(self.bot.appid))] if auth_enabled else []

        fastapi_app = FastAPI()
        bot = self.bot
        path = self._path

        @fastapi_app.post(path, dependencies=deps)
        async def messages(request: Request) -> dict:
            body = await request.body()
            await bot.process_body(body.decode())
            return {}

        @fastapi_app.get("/")
        async def root() -> dict:
            app_id = bot.appid or "(no client ID)"
            return {"message": f"Bot {app_id} Running - send messages to {path}"}

        @fastapi_app.get("/health")
        async def health() -> dict:
            return {"status": "ok"}

        return fastapi_app

    def start(self) -> None:
        """Build the FastAPI app and start Uvicorn. Blocks until shutdown."""
        import uvicorn

        app = self._build_app()
        port = self._port or int(os.environ.get("PORT", "3978"))
        uvicorn.run(app, host="0.0.0.0", port=port)
