# TeamsSample — demonstrates TeamsActivity features:
#   • Mentions — echo back with an @mention of the sender
#   • Suggested Actions — offer quick-reply buttons
#   • Adaptive Cards — send a rich card with Action.Execute
#   • Invoke handling — respond to adaptiveCard/action

from botas_fastapi import BotApp

from fluent_cards import AdaptiveCardBuilder, TextColor, TextSize, TextWeight, to_dict, to_json

from botas import InvokeResponse, TeamsActivityBuilder
from botas.suggested_actions import CardAction, SuggestedActions

app = BotApp()


@app.on_invoke("adaptiveCard/action")
async def on_card_action(ctx):
    value = ctx.activity.value or {}
    action_info = value.get("action", {})
    verb = action_info.get("verb", "unknown")
    data = str(action_info.get("data", {}))

    response_card = (
        AdaptiveCardBuilder.create()
        .with_version("1.5")
        .add_text_block(
            lambda tb: (
                tb.with_text("✅ Action received!")
                .with_size(TextSize.Large)
                .with_weight(TextWeight.Bolder)
                .with_color(TextColor.Good)
            )
        )
        .add_text_block(lambda tb: tb.with_text(f"Verb: {verb}").with_wrap(True))
        .add_text_block(lambda tb: tb.with_text(f"Data: {data}").with_wrap(True))
        .add_action(lambda a: a.execute().with_title("Refresh").with_verb("refresh").with_data({"action": "refresh"}))
        .build()
    )

    return InvokeResponse(
        status=200,
        body={
            "statusCode": 200,
            "type": "application/vnd.microsoft.card.adaptive",
            "value": to_dict(response_card),
        },
    )


@app.on("message")
async def on_message(ctx):
    text = (ctx.activity.text or "").strip()

    if text.lower() == "cards":
        card = (
            AdaptiveCardBuilder.create()
            .with_version("1.5")
            .add_text_block(
                lambda tb: (
                    tb.with_text("Hello from TeamsSample!").with_size(TextSize.Large).with_weight(TextWeight.Bolder)
                )
            )
            .add_text_block(
                lambda tb: tb.with_text("Click the button below to trigger an invoke action.").with_wrap(True)
            )
            .add_input_text(lambda it: it.with_id("userInput").with_placeholder("Type something here..."))
            .add_action(
                lambda a: a.execute().with_title("Submit").with_verb("submitAction").with_data({"action": "submit"})
            )
            .build()
        )

        reply = (
            TeamsActivityBuilder()
            .with_conversation_reference(ctx.activity)
            .with_adaptive_card_attachment(to_json(card))
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
