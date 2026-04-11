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
    id: str
    name: str | None = None
    aad_object_id: str | None = None
    role: str | None = None


class TeamsChannelAccount(ChannelAccount):
    user_principal_name: str | None = None
    email: str | None = None


class ConversationAccount(_CamelModel):
    id: str
    name: str | None = None
    is_group: bool | None = None
    conversation_type: str | None = None
    tenant_id: str | None = None


class Entity(_CamelModel):
    type: str


class Attachment(_CamelModel):
    content_type: str
    content_url: str | None = None
    content: Any = None
    name: str | None = None
    thumbnail_url: str | None = None


class MessageReaction(_CamelModel):
    type: str


class Activity(_CamelModel):
    type: str
    id: str | None = None
    channel_id: str = ""
    service_url: str = ""
    from_account: ChannelAccount | None = None
    recipient: ChannelAccount | None = None
    conversation: ConversationAccount | None = None
    channel_data: Any = None
    entities: list[Entity] | None = None
    attachments: list[Attachment] | None = None
    value: Any = None
    reply_to_id: str | None = None
    text: str | None = None
    name: str | None = None
    action: str | None = None
    locale: str | None = None
    timestamp: str | None = None
    reactions_added: list[MessageReaction] | None = None
    reactions_removed: list[MessageReaction] | None = None
    members_added: list[ChannelAccount] | None = None
    members_removed: list[ChannelAccount] | None = None

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
    def model_validate_json(cls, json_data: str | bytes, **kwargs: Any) -> "Activity":  # type: ignore[override]
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
    conversations: list[ConversationAccount] = []
    continuation_token: str | None = None


class Transcript(_CamelModel):
    activities: list[Activity] = []


def create_reply_activity(activity: Activity, text: str = "") -> dict[str, Any]:
    """Create a reply activity from an incoming activity (FR-005).

    Copies conversation, serviceUrl, and channelId from the original,
    swaps from/recipient, and sets replyToId to the original activity ID.
    Returns a plain camelCase dict ready for JSON serialization.
    """
    return {
        "type": "message",
        "channelId": activity.channel_id,
        "serviceUrl": activity.service_url,
        "conversation": (
            activity.conversation.model_dump(by_alias=True, exclude_none=True) if activity.conversation else None
        ),
        "from": activity.recipient.model_dump(by_alias=True, exclude_none=True) if activity.recipient else None,
        "recipient": (
            activity.from_account.model_dump(by_alias=True, exclude_none=True) if activity.from_account else None
        ),
        "replyToId": activity.id,
        "text": text,
    }
