# TeamsSample — demonstrates TeamsActivity features:
#   • Mentions — echo back with an @mention of the sender
#   • Suggested Actions — offer quick-reply buttons
#   • Adaptive Cards — send a rich card with the user's message

import json

from botas import TeamsActivityBuilder
from botas.suggested_actions import CardAction, SuggestedActions
from botas_fastapi import BotApp

app = BotApp()


@app.on("message")
async def on_message(ctx):
    text = (ctx.activity.text or "").strip()

    if text.lower() == "cards":
        # Send an Adaptive Card
        card_json = json.dumps(
            {
                "type": "AdaptiveCard",
                "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                "version": "1.5",
                "body": [
                    {
                        "type": "TextBlock",
                        "text": "Hello from TeamsSample!",
                        "size": "Large",
                        "weight": "Bolder",
                    },
                    {
                        "type": "TextBlock",
                        "text": "This is an Adaptive Card sent by the bot.",
                        "wrap": True,
                    },
                ],
            }
        )

        reply = (
            TeamsActivityBuilder()
            .with_conversation_reference(ctx.activity)
            .with_adaptive_card_attachment(card_json)
            .build()
        )

        await ctx.send(reply)

    elif text.lower() == "actions":
        # Send Suggested Actions
        reply = (
            TeamsActivityBuilder()
            .with_conversation_reference(ctx.activity)
            .with_text("Pick an option:")
            .with_suggested_actions(
                SuggestedActions(
                    actions=[
                        CardAction(type="imBack", title="🃏 Cards", value="cards"),
                        CardAction(type="imBack", title="👋 Mention", value="mention"),
                        CardAction(type="imBack", title="⚡ Actions", value="actions"),
                    ]
                )
            )
            .build()
        )

        await ctx.send(reply)

    else:
        # Default: echo back with a mention of the sender
        sender = ctx.activity.from_account
        reply = (
            TeamsActivityBuilder()
            .with_conversation_reference(ctx.activity)
            .with_text(f"<at>{sender.name}</at> said: {text}")
            .add_mention(sender)
            .build()
        )

        await ctx.send(reply)


app.start()
