"""Teams-specific activity models and builders.

Extends :class:`CoreActivity` with Teams channel data, meeting info,
suggested actions, and a fluent builder for constructing Teams messages
with mentions and Adaptive Cards.
"""

from __future__ import annotations

import copy
import json
from typing import Any

from pydantic import BaseModel, ConfigDict, model_validator
from pydantic.alias_generators import to_camel

from botas.core_activity import (
    Attachment,
    ChannelAccount,
    Conversation,
    CoreActivity,
    Entity,
)
from botas.suggested_actions import SuggestedActions


class _CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="allow",
    )


class TenantInfo(_CamelModel):
    """Microsoft 365 tenant information.

    Attributes:
        id: The tenant's unique identifier (GUID).
    """

    id: str | None = None


class ChannelInfo(_CamelModel):
    """Teams channel information.

    Attributes:
        id: Unique channel identifier.
        name: Display name of the channel.
    """

    id: str | None = None
    name: str | None = None


class TeamInfo(_CamelModel):
    """Teams team information.

    Attributes:
        id: Unique team identifier.
        name: Display name of the team.
        aad_group_id: Azure AD group ID for the team.
    """

    id: str | None = None
    name: str | None = None
    aad_group_id: str | None = None


class MeetingInfo(_CamelModel):
    """Teams meeting information.

    Attributes:
        id: Unique meeting identifier.
    """

    id: str | None = None


class NotificationInfo(_CamelModel):
    """Teams notification settings (e.g., alert flag for mobile push).

    Attributes:
        alert: When ``True``, triggers a mobile push notification.
    """

    alert: bool | None = None


class TeamsChannelData(_CamelModel):
    """Teams-specific channel data payload.

    Populated in the ``channelData`` field of a Teams activity.

    Attributes:
        tenant: Microsoft 365 tenant information.
        channel: Teams channel details.
        team: Teams team details.
        meeting: Meeting metadata (for meeting-scoped activities).
        notification: Notification settings (e.g. alert flag).
    """

    tenant: TenantInfo | None = None
    channel: ChannelInfo | None = None
    team: TeamInfo | None = None
    meeting: MeetingInfo | None = None
    notification: NotificationInfo | None = None


class TeamsConversation(Conversation):
    """Teams-specific conversation with extended metadata.

    Attributes:
        conversation_type: Type of conversation (``"personal"``, ``"channel"``, ``"groupChat"``).
        tenant_id: Microsoft 365 tenant ID.
        is_group: Whether this is a group conversation.
        name: Display name of the conversation.
    """

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="allow",
    )

    conversation_type: str | None = None
    tenant_id: str | None = None
    is_group: bool | None = None
    name: str | None = None


class TeamsActivity(CoreActivity):
    """Teams-specific activity with strongly-typed channel data and helpers.

    Extends :class:`CoreActivity` with Teams-specific fields like
    ``channel_data``, ``suggested_actions``, and timestamp fields.

    Attributes:
        channel_data: Teams-specific channel data.
        timestamp: Server-side UTC timestamp.
        local_timestamp: Client-side local timestamp.
        locale: User's locale string (e.g. ``"en-US"``).
        local_timezone: User's timezone identifier.
        suggested_actions: Quick-reply buttons.
    """

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
        """Create a TeamsActivity from a generic CoreActivity.

        Validates and re-parses the activity data to populate Teams-specific
        fields like ``channel_data``.

        Args:
            activity: A generic :class:`CoreActivity` to convert.

        Returns:
            A :class:`TeamsActivity` with Teams fields populated.

        Raises:
            ValueError: If ``activity`` is ``None``.
        """
        if activity is None:
            raise ValueError("activity is required")
        data = activity.model_dump()
        return TeamsActivity.model_validate(data)

    def add_entity(self, entity: Entity) -> None:
        """Append an entity to the activity's entities collection.

        Args:
            entity: The entity to add.
        """
        if self.entities is None:
            self.entities = []
        self.entities.append(entity)

    @staticmethod
    def create_builder() -> "TeamsActivityBuilder":
        """Return a new :class:`TeamsActivityBuilder` for fluent construction."""
        return TeamsActivityBuilder()


class TeamsActivityBuilder:
    """Fluent builder for constructing outbound TeamsActivity instances.

    Example::

        activity = (
            TeamsActivity.create_builder()
            .with_conversation_reference(incoming)
            .with_text("Hello!")
            .add_mention(user_account)
            .build()
        )
    """

    def __init__(self) -> None:
        """Initialise the builder with default values (type ``"message"``)."""
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
        """Copy routing fields from an incoming activity and swap from/recipient.

        Args:
            source: The incoming activity to extract routing from.

        Returns:
            The builder instance for chaining.
        """
        self._service_url = source.service_url
        self._conversation = source.conversation
        self._from_account = source.recipient
        self._recipient = source.from_account
        return self

    def with_type(self, activity_type: str) -> "TeamsActivityBuilder":
        """Set the activity type.

        Args:
            activity_type: Activity type string.

        Returns:
            The builder instance for chaining.
        """
        self._type = activity_type
        return self

    def with_service_url(self, service_url: str) -> "TeamsActivityBuilder":
        """Set the service URL.

        Args:
            service_url: Channel service endpoint URL.

        Returns:
            The builder instance for chaining.
        """
        self._service_url = service_url
        return self

    def with_conversation(self, conversation: Conversation) -> "TeamsActivityBuilder":
        """Set the conversation.

        Args:
            conversation: Target conversation.

        Returns:
            The builder instance for chaining.
        """
        self._conversation = conversation
        return self

    def with_from(self, from_account: ChannelAccount) -> "TeamsActivityBuilder":
        """Set the sender account.

        Args:
            from_account: The sender's channel account.

        Returns:
            The builder instance for chaining.
        """
        self._from_account = from_account
        return self

    def with_recipient(self, recipient: ChannelAccount) -> "TeamsActivityBuilder":
        """Set the recipient account.

        Args:
            recipient: The recipient's channel account.

        Returns:
            The builder instance for chaining.
        """
        self._recipient = recipient
        return self

    def with_text(self, text: str) -> "TeamsActivityBuilder":
        """Set the text content.

        Args:
            text: Message text.

        Returns:
            The builder instance for chaining.
        """
        self._text = text
        return self

    def with_channel_data(self, channel_data: TeamsChannelData | None) -> "TeamsActivityBuilder":
        """Set the Teams-specific channel data.

        Args:
            channel_data: Channel data payload, or ``None`` to clear.

        Returns:
            The builder instance for chaining.
        """
        self._channel_data = channel_data
        return self

    def with_suggested_actions(self, suggested_actions: SuggestedActions | None) -> "TeamsActivityBuilder":
        """Set the suggested actions.

        Args:
            suggested_actions: Quick-reply buttons, or ``None`` to clear.

        Returns:
            The builder instance for chaining.
        """
        self._suggested_actions = suggested_actions
        return self

    def with_entities(self, entities: list[Entity] | None) -> "TeamsActivityBuilder":
        """Replace the entities list.

        Args:
            entities: Entity metadata objects, or ``None`` to clear.

        Returns:
            The builder instance for chaining.
        """
        self._entities = entities
        return self

    def with_attachments(self, attachments: list[Attachment] | None) -> "TeamsActivityBuilder":
        """Replace the attachments list.

        Args:
            attachments: Attachment objects, or ``None`` to clear.

        Returns:
            The builder instance for chaining.
        """
        self._attachments = attachments
        return self

    def with_attachment(self, attachment: Attachment) -> "TeamsActivityBuilder":
        """Set a single attachment (replaces the entire collection).

        Args:
            attachment: The sole attachment.

        Returns:
            The builder instance for chaining.
        """
        self._attachments = [attachment]
        return self

    def add_entity(self, entity: Entity) -> "TeamsActivityBuilder":
        """Append an entity to the collection.

        Args:
            entity: The entity to add.

        Returns:
            The builder instance for chaining.
        """
        if self._entities is None:
            self._entities = []
        self._entities.append(entity)
        return self

    def add_attachment(self, attachment: Attachment) -> "TeamsActivityBuilder":
        """Append an attachment to the collection.

        Args:
            attachment: The attachment to add.

        Returns:
            The builder instance for chaining.
        """
        if self._attachments is None:
            self._attachments = []
        self._attachments.append(attachment)
        return self

    def add_mention(self, account: ChannelAccount, mention_text: str | None = None) -> "TeamsActivityBuilder":
        """Create a mention entity for a user.  Does NOT modify the activity text.

        You must manually include the mention text in the activity's ``text``
        field to make it visible in the chat.

        Args:
            account: The channel account to mention.
            mention_text: Custom mention markup.  Defaults to
                ``<at>{account.name}</at>``.

        Returns:
            The builder instance for chaining.

        Raises:
            ValueError: If ``account`` is ``None``.
        """
        if account is None:
            raise ValueError("account is required")
        text = mention_text or f"<at>{account.name}</at>"
        entity = Entity(type="mention", mentioned=account.model_dump(), text=text)
        return self.add_entity(entity)

    def add_adaptive_card_attachment(self, card: str | dict) -> "TeamsActivityBuilder":
        """Parse and append an Adaptive Card as an attachment.

        Args:
            card: A JSON string or pre-parsed dict representing the card.

        Returns:
            The builder instance for chaining.
        """
        content = json.loads(card) if isinstance(card, str) else copy.deepcopy(card)
        attachment = Attachment(
            content_type="application/vnd.microsoft.card.adaptive",
            content=content,
        )
        return self.add_attachment(attachment)

    def with_adaptive_card_attachment(self, card: str | dict) -> "TeamsActivityBuilder":
        """Parse and set an Adaptive Card as the sole attachment.

        Args:
            card: A JSON string or pre-parsed dict representing the card.

        Returns:
            The builder instance for chaining.
        """
        content = json.loads(card) if isinstance(card, str) else copy.deepcopy(card)
        attachment = Attachment(
            content_type="application/vnd.microsoft.card.adaptive",
            content=content,
        )
        return self.with_attachment(attachment)

    def build(self) -> TeamsActivity:
        """Build a new TeamsActivity from the current builder state.

        Returns:
            A fully constructed :class:`TeamsActivity`.
        """
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
