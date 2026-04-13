# TeamsSample — demonstrates TeamsActivity features:
#   • Mentions — echo back with an @mention of the sender
#   • Suggested Actions — offer quick-reply buttons
#   • Adaptive Cards — send a rich card with Action.Execute
#   • Invoke handling — respond to adaptiveCard/action

import json

from botas import InvokeResponse, TeamsActivityBuilder
from botas.suggested_actions import CardAction, SuggestedActions
from botas_fastapi import BotApp

app = BotApp()


@app.on_invoke("adaptiveCard/action")
async def on_card_action(ctx):
    return InvokeResponse(
        status=200,
        body={
            "statusCode": 200,
            "type": "application/vnd.microsoft.card.adaptive",
            "value": {
                "type": "AdaptiveCard",
                "$schema": "http://adaptivecards.io/schemas/adaptive-card.json",
                "version": "1.5",
                "body": [
                    {
                        "type": "TextBlock",
                        "text": "✅ Action received!",
                        "size": "Large",
                        "weight": "Bolder",
                        "color": "Good",
                    },
                    {
                        "type": "TextBlock",
                        "text": "Your submission was processed successfully.",
                        "wrap": True,
                    },
                ],
            },
        },
    )


@app.on("message")
async def on_message(ctx):
    text = (ctx.activity.text or "").strip()

    if text.lower() == "cards":
        # Send an Adaptive Card with Action.Execute
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
                        "text": "Click the button below to trigger an invoke action.",
                        "wrap": True,
                    },
                    {
                        "type": "Input.Text",
                        "id": "userInput",
                        "placeholder": "Type something here...",
                    },
                ],
                "actions": [
                    {
                        "type": "Action.Execute",
                        "title": "Submit",
                        "verb": "submitAction",
                        "data": {"action": "submit"},
                    }
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
