from __future__ import annotations

import json
from typing import Any

from pydantic import ConfigDict, model_validator
from pydantic.alias_generators import to_camel

from botas.core_activity import (
    Attachment,
    ChannelAccount,
    Conversation,
    CoreActivity,
    Entity,
)
from botas.suggested_actions import SuggestedActions
from botas.teams_channel_data import TeamsChannelData


class TeamsActivity(CoreActivity):
    """Teams-specific activity with strongly-typed channel data and helpers."""

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="allow",
    )

    channel_data: TeamsChannelData | None = None
    timestamp: str | None = None
    local_timestamp: str | None = None
    locale: str | None = None
    local_timezone: str | None = None
    suggested_actions: SuggestedActions | None = None

    @model_validator(mode="before")
    @classmethod
    def _remap_from(cls, data: Any) -> Any:
        if isinstance(data, dict) and "from" in data:
            data = dict(data)
            data["from_account"] = data.pop("from")
        return data

    @staticmethod
    def from_activity(activity: CoreActivity) -> "TeamsActivity":
        """Creates a TeamsActivity from a CoreActivity."""
        if activity is None:
            raise ValueError("activity is required")
        data = activity.model_dump()
        return TeamsActivity.model_validate(data)

    def add_entity(self, entity: Entity) -> None:
        """Appends an entity to the entities collection."""
        if self.entities is None:
            self.entities = []
        self.entities.append(entity)

    @staticmethod
    def create_builder() -> "TeamsActivityBuilder":
        """Returns a new TeamsActivityBuilder."""
        from botas.teams_activity_builder import TeamsActivityBuilder
        return TeamsActivityBuilder()


class TeamsActivityBuilder:
    """Fluent builder for constructing outbound TeamsActivity instances."""

    def __init__(self) -> None:
        self._type: str = "message"
        self._service_url: str = ""
        self._conversation: Conversation | None = None
        self._from_account: ChannelAccount | None = None
        self._recipient: ChannelAccount | None = None
        self._text: str = ""
        self._channel_data: TeamsChannelData | None = None
        self._suggested_actions: SuggestedActions | None = None
        self._entities: list[Entity] | None = None
        self._attachments: list[Attachment] | None = None

    def with_conversation_reference(self, source: CoreActivity) -> "TeamsActivityBuilder":
        """Copy routing fields from an incoming activity and swap from/recipient."""
        self._service_url = source.service_url
        self._conversation = source.conversation
        self._from_account = source.recipient
        self._recipient = source.from_account
        return self

    def with_type(self, activity_type: str) -> "TeamsActivityBuilder":
        """Set the activity type."""
        self._type = activity_type
        return self

    def with_service_url(self, service_url: str) -> "TeamsActivityBuilder":
        """Set the service URL."""
        self._service_url = service_url
        return self

    def with_conversation(self, conversation: Conversation) -> "TeamsActivityBuilder":
        """Set the conversation."""
        self._conversation = conversation
        return self

    def with_from(self, from_account: ChannelAccount) -> "TeamsActivityBuilder":
        """Set the sender account."""
        self._from_account = from_account
        return self

    def with_recipient(self, recipient: ChannelAccount) -> "TeamsActivityBuilder":
        """Set the recipient account."""
        self._recipient = recipient
        return self

    def with_text(self, text: str) -> "TeamsActivityBuilder":
        """Set the text content."""
        self._text = text
        return self

    def with_channel_data(self, channel_data: TeamsChannelData | None) -> "TeamsActivityBuilder":
        """Set the Teams-specific channel data."""
        self._channel_data = channel_data
        return self

    def with_suggested_actions(self, suggested_actions: SuggestedActions | None) -> "TeamsActivityBuilder":
        """Set the suggested actions."""
        self._suggested_actions = suggested_actions
        return self

    def with_entities(self, entities: list[Entity] | None) -> "TeamsActivityBuilder":
        """Replace the entities list."""
        self._entities = entities
        return self

    def with_attachments(self, attachments: list[Attachment] | None) -> "TeamsActivityBuilder":
        """Replace the attachments list."""
        self._attachments = attachments
        return self

    def with_attachment(self, attachment: Attachment) -> "TeamsActivityBuilder":
        """Set a single attachment (replaces collection)."""
        self._attachments = [attachment]
        return self

    def add_entity(self, entity: Entity) -> "TeamsActivityBuilder":
        """Append an entity to the collection."""
        if self._entities is None:
            self._entities = []
        self._entities.append(entity)
        return self

    def add_attachment(self, attachment: Attachment) -> "TeamsActivityBuilder":
        """Append an attachment to the collection."""
        if self._attachments is None:
            self._attachments = []
        self._attachments.append(attachment)
        return self

    def add_mention(self, account: ChannelAccount, mention_text: str | None = None) -> "TeamsActivityBuilder":
        """Creates a mention entity. Does NOT modify the activity text."""
        if account is None:
            raise ValueError("account is required")
        text = mention_text or f"<at>{account.name}</at>"
        entity = Entity(type="mention", mentioned=account.model_dump(), text=text)
        return self.add_entity(entity)

    def add_adaptive_card_attachment(self, card_json: str) -> "TeamsActivityBuilder":
        """Parses JSON as an Adaptive Card and appends it as an attachment."""
        content = json.loads(card_json)
        attachment = Attachment(
            content_type="application/vnd.microsoft.card.adaptive",
            content=content,
        )
        return self.add_attachment(attachment)

    def with_adaptive_card_attachment(self, card_json: str) -> "TeamsActivityBuilder":
        """Parses JSON as an Adaptive Card and sets it as the only attachment."""
        content = json.loads(card_json)
        attachment = Attachment(
            content_type="application/vnd.microsoft.card.adaptive",
            content=content,
        )
        return self.with_attachment(attachment)

    def build(self) -> TeamsActivity:
        """Build a new TeamsActivity from the current builder state."""
        return TeamsActivity(
            type=self._type,
            service_url=self._service_url,
            conversation=self._conversation,
            from_account=self._from_account,
            recipient=self._recipient,
            text=self._text,
            channel_data=self._channel_data,
            suggested_actions=self._suggested_actions,
            entities=self._entities,
            attachments=self._attachments,
        )
