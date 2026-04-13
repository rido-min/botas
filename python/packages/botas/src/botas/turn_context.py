from __future__ import annotations

from typing import TYPE_CHECKING, Any

from botas.core_activity import CoreActivity, CoreActivityBuilder, ResourceResponse

if TYPE_CHECKING:
    from botas.bot_application import BotApplication


class TurnContext:
    """Context for a single activity turn, passed to handlers and middleware.

    Provides the incoming activity, a reference to the bot application,
    and a scoped :meth:`send` method that automatically routes replies
    back to the originating conversation.

    Example::

        @bot.on("message")
        async def on_message(ctx: TurnContext):
            await ctx.send(f"You said: {ctx.activity.text}")
    """

    __slots__ = ("activity", "app")

    def __init__(self, app: BotApplication, activity: CoreActivity) -> None:
        self.activity = activity
        self.app = app

    async def send(
        self,
        activity_or_text: "str | CoreActivity | dict[str, Any]",
    ) -> ResourceResponse | None:
        """Send a reply to the conversation that originated this turn.

        Args:
            activity_or_text: One of:
                - ``str`` — sent as a message activity with the given text.
                - :class:`CoreActivity` — merged with routing fields from the
                  incoming activity (caller fields take precedence).
                - ``dict`` — must contain at minimum ``{"type": "message"}``
                  and may include any `Bot Framework Activity
                  <https://learn.microsoft.com/azure/bot-service/rest-api/bot-framework-rest-connector-api-reference#activity-object>`_
                  fields.  Routing fields (``serviceUrl``, ``conversation``,
                  ``from``, ``recipient``) are populated automatically.
        """
        if isinstance(activity_or_text, str):
            reply: CoreActivity | dict[str, Any] = (
                CoreActivityBuilder().with_conversation_reference(self.activity).with_text(activity_or_text).build()
            )
        elif isinstance(activity_or_text, CoreActivity):
            reply = CoreActivityBuilder().with_conversation_reference(self.activity).build()
            # Merge: caller fields take precedence
            merged = reply.model_dump(by_alias=True, exclude_none=True)
            merged.update(activity_or_text.model_dump(by_alias=True, exclude_none=True))
            reply = merged
        else:
            base = (
                CoreActivityBuilder()
                .with_conversation_reference(self.activity)
                .build()
                .model_dump(by_alias=True, exclude_none=True)
            )
            base.update(activity_or_text)
            reply = base

        return await self.app.send_activity_async(
            self.activity.service_url,
            self.activity.conversation.id,
            reply,
        )

    async def send_typing(self) -> None:
        """Send a typing indicator to the conversation.

        Creates a typing activity with routing fields populated from the
        incoming activity. Typing activities are ephemeral and do not
        return a ResourceResponse.

        Example::

            @bot.on("message")
            async def on_message(ctx: TurnContext):
                await ctx.send_typing()
                # ... do some work ...
                await ctx.send("Done!")
        """
        typing_activity = CoreActivityBuilder().with_type("typing").with_conversation_reference(self.activity).build()
        await self.app.send_activity_async(
            self.activity.service_url,
            self.activity.conversation.id,
            typing_activity,
        )
