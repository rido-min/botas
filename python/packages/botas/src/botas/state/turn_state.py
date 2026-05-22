"""Turn state container with three scopes: conversation, user, and temp."""

from __future__ import annotations

from typing import TYPE_CHECKING, Any, Optional, TypeVar

from botas.state.state_scope import StateScope

if TYPE_CHECKING:
    from botas.core_activity import CoreActivity

T = TypeVar("T")


class TurnState:
    """State container for a single turn with three scopes.

    Provides scoped key-value storage for conversation, user, and temporary state.
    State is loaded at turn start and saved at turn end (if the turn succeeds).

    Example::

        # Access via scopes
        context.state.conversation.set("turnCount", 5)
        count = context.state.conversation.get("turnCount", int)

        # Or via path syntax
        context.state.set_value("conversation.turnCount", 5)
        count = context.state.get_value("conversation.turnCount", int)
    """

    def __init__(
        self,
        activity: "CoreActivity",
        conversation_data: Optional[dict[str, Any]] = None,
        user_data: Optional[dict[str, Any]] = None,
    ) -> None:
        """Initialize turn state with scoped data.

        Args:
            activity: The activity for this turn (used for key derivation).
            conversation_data: Initial conversation scope data.
            user_data: Initial user scope data.
        """
        self._activity = activity
        self._conversation = StateScope(conversation_data)
        self._user = StateScope(user_data)
        self._temp = StateScope()

    @property
    def conversation(self) -> StateScope:
        """Conversation-scoped state (persisted per conversation)."""
        return self._conversation

    @property
    def user(self) -> StateScope:
        """User-scoped state (persisted per user across conversations)."""
        return self._user

    @property
    def temp(self) -> StateScope:
        """Temporary state for the current turn (not persisted)."""
        return self._temp

    def get_value(self, path: str, type_: type[T] = object) -> Optional[T]:
        """Get a value by path.

        Path format: "[scope].property" or "property" (defaults to temp).

        Args:
            path: Dot-separated path (e.g., "conversation.count" or "input").
            type_: Type hint for return value (not enforced at runtime).

        Returns:
            The value if it exists, else None.

        Raises:
            ValueError: If path has more than one dot.
        """
        scope, key = self._parse_path(path)
        return scope.get(key, type_)

    def set_value(self, path: str, value: Any) -> None:
        """Set a value by path.

        Path format: "[scope].property" or "property" (defaults to temp).

        Args:
            path: Dot-separated path (e.g., "conversation.count" or "input").
            value: Value to store.

        Raises:
            ValueError: If path has more than one dot.
        """
        scope, key = self._parse_path(path)
        scope.set(key, value)

    def has_value(self, path: str) -> bool:
        """Check if a value exists at path.

        Args:
            path: Dot-separated path (e.g., "conversation.count" or "input").

        Returns:
            True if the value exists, False otherwise.

        Raises:
            ValueError: If path has more than one dot.
        """
        scope, key = self._parse_path(path)
        return scope.has(key)

    def delete_value(self, path: str) -> None:
        """Delete a value at path.

        Args:
            path: Dot-separated path (e.g., "conversation.count" or "input").

        Raises:
            ValueError: If path has more than one dot.
        """
        scope, key = self._parse_path(path)
        scope.delete(key)

    def delete_conversation_state(self) -> None:
        """Delete all state in the conversation scope."""
        self._conversation.clear()

    def delete_user_state(self) -> None:
        """Delete all state in the user scope."""
        self._user.clear()

    def delete_temp_state(self) -> None:
        """Delete all state in the temp scope."""
        self._temp.clear()

    def _parse_path(self, path: str) -> tuple[StateScope, str]:
        """Parse a path string into (scope, key).

        Args:
            path: Dot-separated path (e.g., "conversation.count" or "input").

        Returns:
            Tuple of (scope object, key string).

        Raises:
            ValueError: If path has more than one dot.
        """
        parts = path.split(".")
        if len(parts) > 2:
            raise ValueError(f"Invalid path: {path} (too many dots)")
        if len(parts) == 1:
            # Unqualified path defaults to temp
            return self._temp, parts[0]
        # Qualified path: "scope.key"
        scope_name, key = parts
        if scope_name == "conversation":
            return self._conversation, key
        if scope_name == "user":
            return self._user, key
        if scope_name == "temp":
            return self._temp, key
        raise ValueError(f"Unknown scope: {scope_name}")

    def get_conversation_key(self) -> str:
        """Derive the storage key for conversation scope from the activity.

        Returns:
            Storage key for conversation state.
        """
        channel_id = self._activity.channel_id or ""
        bot_id = self._activity.recipient.id if self._activity.recipient else ""
        conversation_id = self._activity.conversation.id if self._activity.conversation else ""
        return f"{channel_id}/{bot_id}/conversations/{conversation_id}"

    def get_user_key(self) -> str:
        """Derive the storage key for user scope from the activity.

        Returns:
            Storage key for user state.
        """
        channel_id = self._activity.channel_id or ""
        bot_id = self._activity.recipient.id if self._activity.recipient else ""
        user_id = self._activity.from_account.id if self._activity.from_account else ""
        return f"{channel_id}/{bot_id}/users/{user_id}"

    @staticmethod
    def derive_conversation_key(activity: "CoreActivity") -> str:
        """Derive the storage key for conversation scope from an activity.

        Args:
            activity: The activity to derive the key from.

        Returns:
            Storage key for conversation state.
        """
        channel_id = activity.channel_id or ""
        bot_id = activity.recipient.id if activity.recipient else ""
        conversation_id = activity.conversation.id if activity.conversation else ""
        return f"{channel_id}/{bot_id}/conversations/{conversation_id}"

    @staticmethod
    def derive_user_key(activity: "CoreActivity") -> str:
        """Derive the storage key for user scope from an activity.

        Args:
            activity: The activity to derive the key from.

        Returns:
            Storage key for user state.
        """
        channel_id = activity.channel_id or ""
        bot_id = activity.recipient.id if activity.recipient else ""
        user_id = activity.from_account.id if activity.from_account else ""
        return f"{channel_id}/{bot_id}/users/{user_id}"
