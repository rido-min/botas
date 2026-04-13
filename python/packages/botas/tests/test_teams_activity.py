"""Tests for TeamsActivity and TeamsActivityBuilder."""

import json

import pytest

from botas.core_activity import Attachment, ChannelAccount, Conversation, CoreActivity, Entity
from botas.suggested_actions import CardAction, SuggestedActions
from botas.teams_activity import TeamsActivity, TeamsActivityBuilder, TeamsChannelData, TeamsConversation, TenantInfo


class TestTeamsActivity:
    def test_from_activity_copies_basic_fields(self) -> None:
        core = CoreActivity(
            type="message",
            text="hello",
            service_url="http://service.url",
            from_account=ChannelAccount(id="user1", name="User One"),
            recipient=ChannelAccount(id="bot1", name="Bot One"),
            conversation=Conversation(id="conv1"),
        )
        teams = TeamsActivity.from_activity(core)
        assert teams.type == "message"
        assert teams.text == "hello"
        assert teams.service_url == "http://service.url"
        assert teams.from_account is not None
        assert teams.from_account.id == "user1"
        assert teams.recipient is not None
        assert teams.recipient.id == "bot1"

    def test_from_activity_raises_on_none(self) -> None:
        with pytest.raises(ValueError, match="required"):
            TeamsActivity.from_activity(None)  # type: ignore[arg-type]

    def test_deserialize_teams_specific_fields(self) -> None:
        data = {
            "type": "message",
            "text": "hello",
            "from": {"id": "u1"},
            "recipient": {"id": "b1"},
            "conversation": {"id": "c1"},
            "timestamp": "2024-01-01T00:00:00Z",
            "locale": "en-US",
            "localTimezone": "America/Los_Angeles",
            "channelData": {
                "tenant": {"id": "tenant-123"},
                "channel": {"id": "ch-456", "name": "General"},
                "team": {"id": "team-789", "aadGroupId": "group-abc"},
            },
            "suggestedActions": {
                "actions": [{"type": "imBack", "title": "Yes", "value": "yes"}],
            },
        }
        act = TeamsActivity.model_validate(data)
        assert act.type == "message"
        assert act.timestamp == "2024-01-01T00:00:00Z"
        assert act.locale == "en-US"
        assert act.local_timezone == "America/Los_Angeles"
        assert act.channel_data is not None
        assert act.channel_data.tenant is not None
        assert act.channel_data.tenant.id == "tenant-123"
        assert act.channel_data.channel is not None
        assert act.channel_data.channel.name == "General"
        assert act.channel_data.team is not None
        assert act.channel_data.team.aad_group_id == "group-abc"
        assert act.suggested_actions is not None
        assert len(act.suggested_actions.actions) == 1
        assert act.suggested_actions.actions[0].title == "Yes"

    def test_serialize_omits_null_teams_fields(self) -> None:
        act = TeamsActivity(type="message", text="hi")
        d = act.model_dump(exclude_none=True)
        assert "channel_data" not in d
        assert "timestamp" not in d
        assert "suggested_actions" not in d

    def test_serialize_includes_teams_fields(self) -> None:
        act = TeamsActivity(
            type="message",
            text="hi",
            locale="en-US",
            channel_data=TeamsChannelData(tenant=TenantInfo(id="t1")),
        )
        d = act.model_dump(exclude_none=True, by_alias=True)
        assert d["locale"] == "en-US"
        assert d["channelData"]["tenant"]["id"] == "t1"

    def test_channel_data_preserves_unknown_fields(self) -> None:
        data = {
            "type": "message",
            "channelData": {
                "tenant": {"id": "t1"},
                "customField": "custom-value",
            },
        }
        act = TeamsActivity.model_validate(data)
        assert act.channel_data is not None
        assert act.channel_data.tenant is not None
        assert act.channel_data.tenant.id == "t1"
        # extra fields preserved by pydantic's extra="allow"
        d = act.channel_data.model_dump()
        assert d.get("customField") == "custom-value"

    def test_add_entity(self) -> None:
        act = TeamsActivity(type="message")
        act.add_entity(Entity(type="mention"))
        assert act.entities is not None
        assert len(act.entities) == 1
        assert act.entities[0].type == "mention"

    def test_create_builder(self) -> None:
        builder = TeamsActivity.create_builder()
        assert isinstance(builder, TeamsActivityBuilder)


class TestTeamsConversation:
    def test_deserialization(self) -> None:
        data = {
            "id": "conv1",
            "conversationType": "personal",
            "tenantId": "tenant-123",
            "isGroup": False,
            "name": "Chat",
        }
        conv = TeamsConversation.model_validate(data)
        assert conv.id == "conv1"
        assert conv.conversation_type == "personal"
        assert conv.tenant_id == "tenant-123"
        assert conv.is_group is False
        assert conv.name == "Chat"


class TestTeamsActivityBuilder:
    _incoming = CoreActivity(
        type="message",
        text="hello",
        service_url="http://service.url",
        from_account=ChannelAccount(id="user1", name="User One"),
        recipient=ChannelAccount(id="bot1", name="Bot One"),
        conversation=Conversation(id="conv1"),
    )

    def test_build_returns_teams_activity(self) -> None:
        result = TeamsActivityBuilder().with_conversation_reference(self._incoming).with_text("reply").build()
        assert isinstance(result, TeamsActivity)
        assert result.type == "message"
        assert result.text == "reply"

    def test_swaps_from_recipient(self) -> None:
        result = TeamsActivityBuilder().with_conversation_reference(self._incoming).build()
        assert result.from_account is not None
        assert result.from_account.id == "bot1"
        assert result.recipient is not None
        assert result.recipient.id == "user1"

    def test_with_channel_data(self) -> None:
        cd = TeamsChannelData(tenant=TenantInfo(id="tenant-1"))
        result = TeamsActivityBuilder().with_channel_data(cd).build()
        assert result.channel_data is not None
        assert result.channel_data.tenant is not None
        assert result.channel_data.tenant.id == "tenant-1"

    def test_with_suggested_actions(self) -> None:
        sa = SuggestedActions(actions=[CardAction(type="imBack", title="Yes", value="yes")])
        result = TeamsActivityBuilder().with_suggested_actions(sa).build()
        assert result.suggested_actions is not None
        assert len(result.suggested_actions.actions) == 1

    def test_add_mention_creates_entity(self) -> None:
        account = ChannelAccount(id="user1", name="User One")
        result = TeamsActivityBuilder().with_text("Hello <at>User One</at>!").add_mention(account).build()
        assert result.entities is not None
        assert len(result.entities) == 1
        assert result.entities[0].type == "mention"

    def test_add_mention_with_custom_text(self) -> None:
        account = ChannelAccount(id="u1", name="U")
        result = TeamsActivityBuilder().add_mention(account, "<at>Custom</at>").build()
        assert result.entities is not None
        entity_data = result.entities[0].model_dump()
        assert entity_data.get("text") == "<at>Custom</at>"

    def test_add_mention_raises_on_none(self) -> None:
        with pytest.raises(ValueError, match="required"):
            TeamsActivityBuilder().add_mention(None)  # type: ignore[arg-type]

    def test_add_adaptive_card_attachment(self) -> None:
        card_json = '{"type":"AdaptiveCard","body":[]}'
        result = TeamsActivityBuilder().add_adaptive_card_attachment(card_json).build()
        assert result.attachments is not None
        assert len(result.attachments) == 1
        assert result.attachments[0].content_type == "application/vnd.microsoft.card.adaptive"
        assert result.attachments[0].content == {"type": "AdaptiveCard", "body": []}

    def test_with_adaptive_card_attachment_replaces(self) -> None:
        card_json = '{"type":"AdaptiveCard"}'
        result = (
            TeamsActivityBuilder()
            .add_attachment(Attachment(content_type="text/plain"))
            .with_adaptive_card_attachment(card_json)
            .build()
        )
        assert result.attachments is not None
        assert len(result.attachments) == 1
        assert result.attachments[0].content_type == "application/vnd.microsoft.card.adaptive"

    def test_add_adaptive_card_raises_on_invalid_json(self) -> None:
        with pytest.raises(json.JSONDecodeError):
            TeamsActivityBuilder().add_adaptive_card_attachment("not json")

    def test_fluent_chaining(self) -> None:
        result = (
            TeamsActivityBuilder()
            .with_type("message")
            .with_service_url("http://svc")
            .with_conversation(Conversation(id="c1"))
            .with_from(ChannelAccount(id="f1"))
            .with_recipient(ChannelAccount(id="r1"))
            .with_text("test")
            .with_channel_data(TeamsChannelData())
            .with_suggested_actions(SuggestedActions(actions=[]))
            .build()
        )
        assert result.type == "message"
        assert result.service_url == "http://svc"
        assert result.conversation is not None
        assert result.conversation.id == "c1"
        assert result.from_account is not None
        assert result.from_account.id == "f1"
        assert result.text == "test"
        assert result.channel_data is not None
        assert result.suggested_actions is not None
