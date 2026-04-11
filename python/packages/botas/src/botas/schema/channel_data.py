from __future__ import annotations
from pydantic import ConfigDict
from pydantic.alias_generators import to_camel
from botas.schema.activity import _CamelModel


class TeamsChannel(_CamelModel):
    id: str | None = None
    name: str | None = None


class TeamsChannelDataTenant(_CamelModel):
    id: str | None = None


class Team(_CamelModel):
    id: str | None = None
    name: str | None = None


class TeamsChannelDataSettings(_CamelModel):
    selected_channel: TeamsChannel | None = None


class TeamsChannelData(_CamelModel):
    tenant: TeamsChannelDataTenant | None = None
    team: Team | None = None
    channel: TeamsChannel | None = None
    settings: TeamsChannelDataSettings | None = None
