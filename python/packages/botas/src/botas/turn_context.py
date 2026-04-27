from __future__ import annotations

from typing import TYPE_CHECKING, Any, Optional, Union

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
        """Initialise the turn context.

        Args:
            app: The bot application instance processing this turn.
            activity: The incoming activity for this turn.
        """
        self.activity = activity
        self.app = app

    async def send(
        self,
        activity_or_text: Union[
            str,
            CoreActivity,
            dict[str, Any],
        ],
    ) -> Optional[ResourceResponse]:
        """Send a reply to the conversation that originated this turn.

        Accepts a plain text string (sent as a message activity), a
        :class:`CoreActivity`, or a dict for full control over the reply.
        Routing fields are automatically populated from the incoming activity.

        When passing a dict, you must provide at minimum a ``type`` field.
        Other fields such as ``text``, ``attachments``, ``suggestedActions``, etc.
        are optional and depend on the activity type.  Routing fields
        (``from``, ``recipient``, ``conversation``, ``serviceUrl``, ``channelId``)
        are auto-populated but can be overridden.

        Args:
            activity_or_text: A plain string, a :class:`CoreActivity`, or a dict.

        Returns:
            A :class:`ResourceResponse` with the sent activity ID, or ``None``.

        Example::

            # Simple text reply
            await ctx.send("Hello!")

            # Dict with custom fields
            await ctx.send({
                "type": "message",
                "text": "Hello!",
                "attachments": [...]
            })
        """
        if isinstance(activity_or_text, str):
            reply: Union[CoreActivity, dict[str, Any]] = (
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
