from __future__ import annotations

from pydantic import ConfigDict
from pydantic.alias_generators import to_camel

from botas.core_activity import Conversation


class TeamsConversation(Conversation):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="allow",
    )

    conversation_type: str | None = None
    tenant_id: str | None = None
    is_group: bool | None = None
    name: str | None = None
