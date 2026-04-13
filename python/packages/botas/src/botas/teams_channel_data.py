from __future__ import annotations

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class _CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="allow",
    )


class TenantInfo(_CamelModel):
    id: str | None = None


class ChannelInfo(_CamelModel):
    id: str | None = None
    name: str | None = None


class TeamInfo(_CamelModel):
    id: str | None = None
    name: str | None = None
    aad_group_id: str | None = None


class MeetingInfo(_CamelModel):
    id: str | None = None


class NotificationInfo(_CamelModel):
    alert: bool | None = None


class TeamsChannelData(_CamelModel):
    tenant: TenantInfo | None = None
    channel: ChannelInfo | None = None
    team: TeamInfo | None = None
    meeting: MeetingInfo | None = None
    notification: NotificationInfo | None = None
