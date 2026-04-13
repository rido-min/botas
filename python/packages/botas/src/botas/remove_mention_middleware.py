from __future__ import annotations

import re
from typing import TYPE_CHECKING

from botas.i_turn_middleware import NextTurn

if TYPE_CHECKING:
    from botas.turn_context import TurnContext


class RemoveMentionMiddleware:
    """Strips @mention text from the activity when the mention targets the bot.

    Useful in Teams where every message to a bot is prefixed with
    ``<at>BotName</at>``.  After this middleware runs, handlers receive
    clean, human-typed text.

    Usage::

        from botas import BotApplication
        from botas.remove_mention_middleware import RemoveMentionMiddleware

        bot = BotApplication()
        bot.use(RemoveMentionMiddleware())
    """

    async def on_turn_async(self, context: TurnContext, next: NextTurn) -> None:
        activity = context.activity
        if activity.text and activity.entities:
            bot_id = context.app.appid or (
                activity.recipient.id if activity.recipient else None
            )
            if bot_id:
                for entity in activity.entities:
                    raw = entity.model_dump(by_alias=True)
                    if raw.get("type") != "mention":
                        continue

                    mentioned = raw.get("mentioned", {})
                    mentioned_id = mentioned.get("id", "")
                    mention_text = raw.get("text", "")

                    if mentioned_id.casefold() == bot_id.casefold() and mention_text:
                        activity.text = re.sub(
                            re.escape(mention_text), "", activity.text, flags=re.IGNORECASE
                        ).strip()

        await next()
