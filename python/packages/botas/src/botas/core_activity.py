"""Bot Service activity schema models.

Defines :class:`CoreActivity` and supporting types (accounts, conversations,
attachments, entities) as Pydantic models with camelCase JSON aliases.
Unknown JSON properties are preserved via ``extra="allow"`` for round-trip safety.
"""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, model_validator
from pydantic.alias_generators import to_camel

ActivityType = Literal["message", "typing", "invoke"]
"""Core activity type strings used by :class:`BotApplication` for dispatch."""

TeamsActivityType = Literal[
    "message",
    "typing",
    "invoke",
    "event",
    "conversationUpdate",
    "messageUpdate",
    "messageDelete",
    "messageReaction",
    "installationUpdate",
]
"""Extended activity type strings for Teams and other Bot Service channels."""


class _CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="allow",
    )


class ChannelAccount(_CamelModel):
    """Represents a user or bot account on a channel.

    Used for the ``from`` and ``recipient`` fields of an activity.

    Attributes:
        id: Unique account identifier on the channel.
        name: Display name of the account.
        aad_object_id: Azure AD object ID (when available).
        role: Account role (``"bot"`` or ``"user"``).
    """

    id: str
    name: str | None = None
    aad_object_id: str | None = None
    role: str | None = None


class TeamsChannelAccount(ChannelAccount):
    """Teams-specific channel account with extended user properties.

    Attributes:
        user_principal_name: The user's UPN (e.g. ``user@contoso.com``).
        email: The user's email address.
    """

    user_principal_name: str | None = None
    email: str | None = None


class Conversation(_CamelModel):
    """Represents a conversation (chat, channel, or group) on a channel.

    Attributes:
        id: Unique conversation identifier on the channel.
    """

    id: str


class Entity(_CamelModel):
    """Bot Service entity metadata (mentions, places, etc.).

    Extra fields are preserved via Pydantic's ``extra="allow"`` config.
    """

    type: str


class Attachment(_CamelModel):
    """Bot Service attachment (images, cards, files, etc.).

    Attributes:
        content_type: MIME type (e.g. ``"application/vnd.microsoft.card.adaptive"``).
        content_url: URL to download the attachment content.
        content: Inline attachment content (e.g. an Adaptive Card JSON object).
        name: Display name / filename.
        thumbnail_url: URL to a thumbnail image.
    """

    content_type: str
    content_url: str | None = None
    content: Any = None
    name: str | None = None
    thumbnail_url: str | None = None


class CoreActivity(_CamelModel):
    """Bot Service activity payload.

    Represents an incoming or outgoing message, typing indicator, or other event.
    Routing fields (``from``, ``recipient``, ``conversation``, ``serviceUrl``) are
    automatically populated for outbound messages.  Unknown JSON properties are
    preserved via Pydantic's ``extra="allow"`` config (e.g. ``channelData``,
    ``membersAdded``).

    Note:
        The ``from`` JSON field is mapped to ``from_account`` because ``from``
        is a Python reserved keyword.  Serialization via :meth:`model_dump`
        restores the original ``from`` key.

    Attributes:
        type: Activity type (``"message"``, ``"typing"``, ``"invoke"``, etc.).
        service_url: Channel service endpoint URL.
        from_account: Sender's channel account (mapped from JSON ``from``).
        recipient: Recipient's channel account.
        conversation: Conversation reference.
        text: Message text content.
        name: Sub-type name (used by ``invoke`` activities).
        value: Payload for ``invoke`` or ``messageReaction`` activities.
        entities: List of entity metadata (mentions, places, etc.).
        attachments: List of file or card attachments.
    """

    type: str
    service_url: str = ""
    from_account: ChannelAccount | None = None
    recipient: ChannelAccount | None = None
    conversation: Conversation | None = None
    text: str | None = None
    name: str | None = None
    value: Any = None
    entities: list[Entity] | None = None
    attachments: list[Attachment] | None = None

    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="allow",
        # 'from' is a Python keyword — remapped via model_validator below
    )

    @model_validator(mode="before")
    @classmethod
    def _remap_from(cls, data: Any) -> Any:
        if isinstance(data, dict) and "from" in data:
            data = dict(data)
            data["from_account"] = data.pop("from")
        return data

    @classmethod
    def model_validate_json(cls, json_data: str | bytes, **kwargs: Any) -> "CoreActivity":  # type: ignore[override]
        """Deserialize a JSON string or bytes into a CoreActivity.

        Handles the ``from`` → ``from_account`` remapping automatically.

        Args:
            json_data: Raw JSON string or bytes.
            **kwargs: Additional keyword arguments passed to ``model_validate``.

        Returns:
            A validated :class:`CoreActivity` instance.
        """
        import json

        data = json.loads(json_data)
        return cls.model_validate(data, **kwargs)

    def model_dump(self, **kwargs: Any) -> dict[str, Any]:  # type: ignore[override]
        """Serialize to a dict, restoring ``from_account`` back to ``from``.

        Args:
            **kwargs: Keyword arguments forwarded to Pydantic's ``model_dump``.

        Returns:
            A JSON-compatible dict with camelCase keys when ``by_alias=True``.
        """
        d = super().model_dump(**kwargs)
        # remap 'from_account' → 'from' in output
        if "from_account" in d:
            d["from"] = d.pop("from_account")
        elif "fromAccount" in d:
            d["from"] = d.pop("fromAccount")
        return d


class ResourceResponse(_CamelModel):
    """Response from the channel after sending or updating an activity.

    Attributes:
        id: The channel-assigned activity identifier.
    """

    id: str


class ConversationResourceResponse(ResourceResponse):
    """Response from creating a new conversation.

    Attributes:
        service_url: The service URL for the newly created conversation.
        activity_id: ID of the initial activity in the conversation.
    """

    service_url: str
    activity_id: str


class PagedMembersResult(_CamelModel):
    """Paginated result of conversation members.

    Attributes:
        members: List of member accounts for the current page.
        continuation_token: Opaque token to fetch the next page, or ``None``
            when all members have been returned.
    """

    members: list[ChannelAccount] = []
    continuation_token: str | None = None


class ConversationParameters(_CamelModel):
    """Parameters for creating a new conversation via the REST API.

    Attributes:
        is_group: Whether the conversation is a group conversation.
        bot: The bot's channel account.
        members: Initial members to add to the conversation.
        topic_name: Display name / topic for the conversation.
        tenant_id: Microsoft 365 tenant ID (Teams).
        activity: Optional initial activity to send.
        channel_data: Channel-specific creation data.
    """

    is_group: bool | None = None
    bot: ChannelAccount | None = None
    members: list[ChannelAccount] | None = None
    topic_name: str | None = None
    tenant_id: str | None = None
    activity: dict[str, Any] | None = None
    channel_data: Any = None


class ConversationsResult(_CamelModel):
    """Paginated result of conversations the bot has participated in.

    Attributes:
        conversations: List of conversations for the current page.
        continuation_token: Opaque token to fetch the next page.
    """

    conversations: list[Conversation] = []
    continuation_token: str | None = None


class Transcript(_CamelModel):
    """A collection of activities representing a conversation transcript.

    Attributes:
        activities: Ordered list of activities in the transcript.
    """

    activities: list[CoreActivity] = []


class CoreActivityBuilder:
    """Fluent builder for constructing outbound CoreActivity instances.

    Example::

        activity = (
            CoreActivityBuilder()
            .with_conversation_reference(incoming)
            .with_text("Hello!")
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
        self._entities: list[Entity] | None = None
        self._attachments: list[Attachment] | None = None

    def with_conversation_reference(self, source: CoreActivity) -> "CoreActivityBuilder":
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

    def with_type(self, activity_type: str) -> "CoreActivityBuilder":
        """Set the activity type (default is ``"message"``).

        Args:
            activity_type: Activity type string.

        Returns:
            The builder instance for chaining.
        """
        self._type = activity_type
        return self

    def with_service_url(self, service_url: str) -> "CoreActivityBuilder":
        """Set the service URL for the channel.

        Args:
            service_url: Channel service endpoint URL.

        Returns:
            The builder instance for chaining.
        """
        self._service_url = service_url
        return self

    def with_conversation(self, conversation: Conversation) -> "CoreActivityBuilder":
        """Set the conversation reference.

        Args:
            conversation: Target conversation.

        Returns:
            The builder instance for chaining.
        """
        self._conversation = conversation
        return self

    def with_from(self, from_account: ChannelAccount) -> "CoreActivityBuilder":
        """Set the sender account.

        Args:
            from_account: The sender's channel account.

        Returns:
            The builder instance for chaining.
        """
        self._from_account = from_account
        return self

    def with_recipient(self, recipient: ChannelAccount) -> "CoreActivityBuilder":
        """Set the recipient account.

        Args:
            recipient: The recipient's channel account.

        Returns:
            The builder instance for chaining.
        """
        self._recipient = recipient
        return self

    def with_text(self, text: str) -> "CoreActivityBuilder":
        """Set the text content of the activity.

        Args:
            text: Message text.

        Returns:
            The builder instance for chaining.
        """
        self._text = text
        return self

    def with_entities(self, entities: list[Entity]) -> "CoreActivityBuilder":
        """Set the entities list.

        Args:
            entities: Entity metadata objects.

        Returns:
            The builder instance for chaining.
        """
        self._entities = entities
        return self

    def with_attachments(self, attachments: list[Attachment]) -> "CoreActivityBuilder":
        """Set the attachments list.

        Args:
            attachments: Attachment objects.

        Returns:
            The builder instance for chaining.
        """
        self._attachments = attachments
        return self

    def build(self) -> CoreActivity:
        """Build a new CoreActivity from the current builder state.

        Returns:
            A fully constructed :class:`CoreActivity`.
        """
        return CoreActivity(
            type=self._type,
            service_url=self._service_url,
            conversation=self._conversation,
            from_account=self._from_account,
            recipient=self._recipient,
            text=self._text,
            entities=self._entities,
            attachments=self._attachments,
        )
