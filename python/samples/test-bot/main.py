# Test Bot — feature-rich bot for E2E/Playwright testing
# Run: python main.py

import logging
import platform

from botas_fastapi import BotApp

from botas import BotApplication, InvokeResponse

logging.basicConfig(level=logging.DEBUG)

app = BotApp()


@app.on("message")
async def on_message(ctx):
    text = (ctx.activity.text or "").strip()
    if text.lower() == "card":
        await ctx.send(
            {
                "type": "message",
                "attachments": [
                    {
                        "contentType": "application/vnd.microsoft.card.adaptive",
                        "content": {
                            "type": "AdaptiveCard",
                            "version": "1.5",
                            "body": [
                                {"type": "TextBlock", "text": "Invoke Test Card", "weight": "bolder"},
                                {"type": "TextBlock", "text": "Click the button to trigger an invoke."},
                            ],
                            "actions": [
                                {
                                    "type": "Action.Execute",
                                    "title": "Submit",
                                    "verb": "test",
                                    "data": {"source": "e2e"},
                                }
                            ],
                        },
                    }
                ],
            }
        )
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
