from __future__ import annotations

from botas.schema.activity import _CamelModel


class ChannelData(_CamelModel):
    client_activity_id: str | None = None
