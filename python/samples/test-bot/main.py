# Test Bot — feature-rich bot for E2E/Playwright testing
# Run: python main.py

import json
import logging
import platform

from botas_fastapi import BotApp
from fluent_cards import AdaptiveCardBuilder, TextWeight, to_dict

from botas import BotApplication, InvokeResponse, TeamsActivityBuilder

logging.basicConfig(level=logging.DEBUG)

app = BotApp()


@app.on("message")
async def on_message(ctx):
    text = (ctx.activity.text or "").strip()
    if text.lower() == "card":
        card = (
            AdaptiveCardBuilder.create()
            .with_version("1.5")
            .add_text_block(lambda tb: tb.with_text("Invoke Test Card").with_weight(TextWeight.Bolder))
            .add_text_block(lambda tb: tb.with_text("Click the button to trigger an invoke."))
            .add_action(lambda a: a.execute().with_title("Submit").with_verb("test").with_data({"source": "e2e"}))
            .build()
        )

        await ctx.send(
            {
                "type": "message",
                "attachments": [
                    {
                        "contentType": "application/vnd.microsoft.card.adaptive",
                        "content": to_dict(card),
                    }
                ],
            }
        )
    elif text.lower() == "submit":
        # Action.Submit card — clicking produces a message activity with flat activity.value
        card = (
            AdaptiveCardBuilder.create()
            .with_version("1.5")
            .add_text_block(lambda tb: tb.with_text("Action.Submit Test Card").with_weight(TextWeight.Bolder))
            .add_text_block(lambda tb: tb.with_text("Click the button to send a message with value."))
            .add_action(
                lambda a: a.submit().with_title("Send").with_data({"source": "e2e", "action": "submit"})
            )
            .build()
        )

        await ctx.send(
            {
                "type": "message",
                "attachments": [
                    {
                        "contentType": "application/vnd.microsoft.card.adaptive",
                        "content": to_dict(card),
                    }
                ],
            }
        )
    elif text.lower().startswith("mention"):
        sender = ctx.activity.from_account
        display_name = (sender.name if sender else None) or (sender.id if sender else None) or "user"
        reply = (
            TeamsActivityBuilder()
            .with_conversation_reference(ctx.activity)
            .with_text(f"<at>{display_name}</at> said: {ctx.activity.text}")
            .add_mention(sender)
            .build()
        )
        await ctx.send(reply)
    elif ctx.activity.value is not None and not text:
        # Action.Submit produces a message with activity.value (no text)
        await ctx.send(f"Submit received: {json.dumps(ctx.activity.value)}")
    else:
        plat = f"Python {platform.python_version()} ({platform.system()})"
        await ctx.send(f"Echo: {ctx.activity.text} [botas-python v{BotApplication.version} | {plat}]")


@app.on_invoke("adaptiveCard/action")
async def on_invoke_action(ctx):
    return InvokeResponse(
        status=200,
        body={
            "statusCode": 200,
            "type": "application/vnd.microsoft.card.adaptive",
            "value": {
                "type": "AdaptiveCard",
                "version": "1.5",
                "body": [{"type": "TextBlock", "text": "✅ Invoke received!", "weight": "bolder"}],
            },
        },
    )


@app.on_invoke("test/echo")
async def on_invoke_echo(ctx):
    return InvokeResponse(status=200, body=ctx.activity.value)


app.start()
