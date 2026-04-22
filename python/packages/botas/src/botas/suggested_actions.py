"""Bot Framework suggested actions and card action models."""

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
    """A clickable action button presented to the user.

    Attributes:
        type: Action type (``"imBack"``, ``"postBack"``, ``"openUrl"``, etc.).
        title: Button label displayed to the user.
        value: Value sent back to the bot when the button is clicked.
        text: Text sent to the bot (for ``imBack`` actions).
        display_text: Text displayed in the chat when the button is clicked.
        image: URL of an icon image for the button.
    """

    type: str = "imBack"
    title: str | None = None
    value: str | None = None
    text: str | None = None
    display_text: str | None = None
    image: str | None = None


class SuggestedActions(_CamelModel):
    """A set of suggested action buttons presented alongside a message.

    Attributes:
        to: List of channel account IDs the suggestions are targeted at.
            When ``None``, suggestions are shown to all participants.
        actions: List of :class:`CardAction` buttons.
    """

    to: list[str] | None = None
    actions: list[CardAction] = []
