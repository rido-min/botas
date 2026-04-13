# Re-export core types so consumers can use a single import
from botas import (
    BotApplication,
    BotApplicationOptions,
    BotAuthError,
    BotHandlerException,
    ChannelAccount,
    Conversation,
    ConversationClient,
    CoreActivity,
    CoreActivityBuilder,
    ITurnMiddleware,
    ResourceResponse,
    TeamsChannelAccount,
    TokenManager,
    TurnContext,
    validate_bot_token,
)

from botas_fastapi.bot_app import BotApp
from botas_fastapi.bot_auth import bot_auth_dependency

__all__ = [
    # botas-fastapi specific
    "BotApp",
    "bot_auth_dependency",
    # re-exported from botas core
    "BotApplication",
    "BotApplicationOptions",
    "BotAuthError",
    "BotHandlerException",
    "ChannelAccount",
    "Conversation",
    "ConversationClient",
    "CoreActivity",
    "CoreActivityBuilder",
    "ITurnMiddleware",
    "ResourceResponse",
    "TeamsChannelAccount",
    "TokenManager",
    "TurnContext",
    "validate_bot_token",
]
