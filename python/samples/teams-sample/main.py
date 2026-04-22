# TeamsSample — demonstrates TeamsActivity features:
#   • conversationUpdate — welcome new members joining the conversation
#   • messageReaction — acknowledge emoji reactions on messages
#   • typing — log when a user is typing
#   • installationUpdate — greet when the bot is installed
#   • Mentions — echo back with an @mention of the sender
#   • Suggested Actions — offer quick-reply buttons
#   • Adaptive Cards — send a rich card with Action.Execute
#   • Invoke handling — respond to adaptiveCard/action

from botas_fastapi import BotApp
from fluent_cards import AdaptiveCardBuilder, TextColor, TextSize, TextWeight, to_dict

from botas import InvokeResponse, TeamsActivityBuilder
from botas.suggested_actions import CardAction, SuggestedActions

app = BotApp()


@app.on("conversationUpdate")
async def on_conversation_update(ctx):
    members_added = getattr(ctx.activity, "membersAdded", None) or []
    recipient = ctx.activity.recipient
    for member in members_added:
        if member.get("id") != (recipient.id if recipient else None):
            name = member.get("name", "there")
            welcome = (
                TeamsActivityBuilder()
                .with_conversation_reference(ctx.activity)
                .with_text(f"Welcome to the team, {name}! 👋")
                .build()
            )
            await ctx.send(welcome)


@app.on("messageReaction")
async def on_message_reaction(ctx):
    reactions_added = getattr(ctx.activity, "reactionsAdded", None) or []
    for reaction in reactions_added:
        reaction_type = reaction.get("type", "unknown") if isinstance(reaction, dict) else reaction
        reply = (
            TeamsActivityBuilder()
            .with_conversation_reference(ctx.activity)
            .with_text(f"Thanks for the {reaction_type} reaction! 👍")
            .build()
        )
        await ctx.send(reply)


@app.on("typing")
async def on_typing(ctx):
    sender = ctx.activity.from_account
    name = sender.name if sender else "Unknown"
    print(f"User {name} is typing...")


@app.on("installationUpdate")
async def on_installation_update(ctx):
    action = getattr(ctx.activity, "action", None) or "unknown"
    print(f"Installation update: {action}")
    if action == "add":
        reply = (
            TeamsActivityBuilder()
            .with_conversation_reference(ctx.activity)
            .with_text("Thanks for installing me! Type 'cards' to see what I can do. 🚀")
            .build()
        )
        await ctx.send(reply)


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
            .with_adaptive_card_attachment(to_dict(card))
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
