from __future__ import annotations

from typing import Any

from pydantic import BaseModel, ConfigDict, model_validator
from pydantic.alias_generators import to_camel


class _CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="allow",
    )


class ChannelAccount(_CamelModel):
    """Represents a user or bot account on a channel.

    Used for the 'from' and 'recipient' fields of an activity.
    """

    id: str
    name: str | None = None
    aad_object_id: str | None = None
    role: str | None = None


class TeamsChannelAccount(ChannelAccount):
    """Teams-specific channel account with extended user properties."""

    user_principal_name: str | None = None
    email: str | None = None


class Conversation(_CamelModel):
    """Represents a conversation (chat, channel, or group) on a channel."""

    id: str


class Entity(_CamelModel):
    """Bot Framework entity metadata (mentions, places, etc.).

    Extra fields are preserved via Pydantic's ``extra="allow"`` config.
    """

    type: str


class Attachment(_CamelModel):
    """Bot Framework attachment (images, cards, files, etc.)."""

    content_type: str
    content_url: str | None = None
    content: Any = None
    name: str | None = None
    thumbnail_url: str | None = None


class CoreActivity(_CamelModel):
    """Bot Framework activity payload.

    Represents an incoming or outgoing message, typing indicator, or other event.
    Routing fields (``from``, ``recipient``, ``conversation``, ``serviceUrl``) are
    automatically populated for outbound messages. Unknown JSON properties are
    preserved via Pydantic's ``extra="allow"`` config (e.g., ``channelData``).
    """

    type: str
    service_url: str = ""
    from_account: ChannelAccount | None = None
    recipient: ChannelAccount | None = None
    conversation: Conversation | None = None
    text: str | None = None
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
        import json

        data = json.loads(json_data)
        return cls.model_validate(data, **kwargs)

    def model_dump(self, **kwargs: Any) -> dict[str, Any]:  # type: ignore[override]
        d = super().model_dump(**kwargs)
        # remap 'from_account' → 'from' in output
        if "from_account" in d:
            d["from"] = d.pop("from_account")
        elif "fromAccount" in d:
            d["from"] = d.pop("fromAccount")
        return d


class ResourceResponse(_CamelModel):
    id: str


class ConversationResourceResponse(ResourceResponse):
    service_url: str
    activity_id: str


class PagedMembersResult(_CamelModel):
    members: list[ChannelAccount] = []
    continuation_token: str | None = None


class ConversationParameters(_CamelModel):
    is_group: bool | None = None
    bot: ChannelAccount | None = None
    members: list[ChannelAccount] | None = None
    topic_name: str | None = None
    tenant_id: str | None = None
    activity: dict[str, Any] | None = None
    channel_data: Any = None


class ConversationsResult(_CamelModel):
    conversations: list[Conversation] = []
    continuation_token: str | None = None


class Transcript(_CamelModel):
    activities: list[CoreActivity] = []


class CoreActivityBuilder:
    """Fluent builder for constructing outbound CoreActivity instances."""

    def __init__(self) -> None:
        self._type: str = "message"
        self._service_url: str = ""
        self._conversation: Conversation | None = None
        self._from_account: ChannelAccount | None = None
        self._recipient: ChannelAccount | None = None
        self._text: str = ""
        self._entities: list[Entity] | None = None
        self._attachments: list[Attachment] | None = None

    def with_conversation_reference(self, source: CoreActivity) -> "CoreActivityBuilder":
        """Copy routing fields from an incoming activity and swap from/recipient."""
        self._service_url = source.service_url
        self._conversation = source.conversation
        self._from_account = source.recipient
        self._recipient = source.from_account
        return self

    def with_type(self, activity_type: str) -> "CoreActivityBuilder":
        """Set the activity type (default is ``"message"``)."""
        self._type = activity_type
        return self

    def with_service_url(self, service_url: str) -> "CoreActivityBuilder":
        """Set the service URL for the channel."""
        self._service_url = service_url
        return self

    def with_conversation(self, conversation: Conversation) -> "CoreActivityBuilder":
        """Set the conversation reference."""
        self._conversation = conversation
        return self

    def with_from(self, from_account: ChannelAccount) -> "CoreActivityBuilder":
        """Set the sender account."""
        self._from_account = from_account
        return self

    def with_recipient(self, recipient: ChannelAccount) -> "CoreActivityBuilder":
        """Set the recipient account."""
        self._recipient = recipient
        return self

    def with_text(self, text: str) -> "CoreActivityBuilder":
        """Set the text content of the activity."""
        self._text = text
        return self

    def with_entities(self, entities: list[Entity]) -> "CoreActivityBuilder":
        """Set the entities list."""
        self._entities = entities
        return self

    def with_attachments(self, attachments: list[Attachment]) -> "CoreActivityBuilder":
        """Set the attachments list."""
        self._attachments = attachments
        return self

    def build(self) -> CoreActivity:
        """Build a new CoreActivity from the current builder state."""
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
