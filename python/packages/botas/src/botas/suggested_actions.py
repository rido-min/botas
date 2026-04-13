from __future__ import annotations

from pydantic import BaseModel, ConfigDict
from pydantic.alias_generators import to_camel


class _CamelModel(BaseModel):
    model_config = ConfigDict(
        alias_generator=to_camel,
        populate_by_name=True,
        extra="allow",
    )


class CardAction(_CamelModel):
    type: str = "imBack"
    title: str | None = None
    value: str | None = None
    text: str | None = None
    display_text: str | None = None
    image: str | None = None


class SuggestedActions(_CamelModel):
    to: list[str] | None = None
    actions: list[CardAction] = []
