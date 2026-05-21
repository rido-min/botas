"""Tests for TurnState and StateScope."""

from __future__ import annotations

import pytest

from botas.core_activity import ChannelAccount, Conversation, CoreActivity
from botas.state import StateScope, TurnState


@pytest.fixture
def activity():
    """Create a sample activity for testing."""
    return CoreActivity(
        type="message",
        channel_id="msteams",
        from_account=ChannelAccount(id="user-123"),
        recipient=ChannelAccount(id="bot-456"),
        conversation=Conversation(id="conv-789"),
        service_url="https://smba.trafficmanager.net/amer/",
    )


class TestStateScope:
    """Tests for StateScope class."""

    def test_get_set(self):
        scope = StateScope()
        scope.set("count", 5)
        assert scope.get("count", int) == 5

    def test_get_missing_returns_none(self):
        scope = StateScope()
        assert scope.get("missing", int) is None

    def test_has(self):
        scope = StateScope()
        scope.set("count", 5)
        assert scope.has("count") is True
        assert scope.has("missing") is False

    def test_delete(self):
        scope = StateScope()
        scope.set("count", 5)
        scope.delete("count")
        assert scope.has("count") is False

    def test_delete_idempotent(self):
        scope = StateScope()
        scope.delete("missing")  # Should not raise

    def test_clear(self):
        scope = StateScope()
        scope.set("a", 1)
        scope.set("b", 2)
        scope.clear()
        assert scope.has("a") is False
        assert scope.has("b") is False

    def test_is_dirty_after_set(self):
        scope = StateScope()
        assert scope.is_dirty() is False
        scope.set("count", 5)
        assert scope.is_dirty() is True

    def test_is_dirty_after_delete(self):
        scope = StateScope({"count": 5})
        assert scope.is_dirty() is False
        scope.delete("count")
        assert scope.is_dirty() is True

    def test_not_dirty_when_unchanged(self):
        scope = StateScope({"count": 5})
        assert scope.is_dirty() is False

    def test_is_deleted_when_cleared(self):
        scope = StateScope({"count": 5})
        assert scope.is_deleted() is False
        scope.clear()
        assert scope.is_deleted() is True

    def test_not_deleted_when_empty_from_start(self):
        scope = StateScope()
        assert scope.is_deleted() is False


class TestTurnState:
    """Tests for TurnState class."""

    def test_scopes_initialized(self, activity):
        state = TurnState(activity)
        assert state.conversation is not None
        assert state.user is not None
        assert state.temp is not None

    def test_conversation_scope_isolation(self, activity):
        state = TurnState(activity)
        state.conversation.set("count", 5)
        assert state.conversation.get("count", int) == 5
        assert state.user.get("count", int) is None
        assert state.temp.get("count", int) is None

    def test_user_scope_isolation(self, activity):
        state = TurnState(activity)
        state.user.set("name", "Alice")
        assert state.user.get("name", str) == "Alice"
        assert state.conversation.get("name", str) is None
        assert state.temp.get("name", str) is None

    def test_temp_scope_isolation(self, activity):
        state = TurnState(activity)
        state.temp.set("input", "hello")
        assert state.temp.get("input", str) == "hello"
        assert state.conversation.get("input", str) is None
        assert state.user.get("input", str) is None

    def test_get_value_qualified_path(self, activity):
        state = TurnState(activity)
        state.conversation.set("count", 5)
        assert state.get_value("conversation.count", int) == 5

    def test_set_value_qualified_path(self, activity):
        state = TurnState(activity)
        state.set_value("user.name", "Alice")
        assert state.user.get("name", str) == "Alice"

    def test_get_value_unqualified_defaults_to_temp(self, activity):
        state = TurnState(activity)
        state.temp.set("input", "hello")
        assert state.get_value("input", str) == "hello"

    def test_set_value_unqualified_defaults_to_temp(self, activity):
        state = TurnState(activity)
        state.set_value("input", "hello")
        assert state.temp.get("input", str) == "hello"

    def test_has_value(self, activity):
        state = TurnState(activity)
        state.conversation.set("count", 5)
        assert state.has_value("conversation.count") is True
        assert state.has_value("conversation.missing") is False

    def test_delete_value(self, activity):
        state = TurnState(activity)
        state.conversation.set("count", 5)
        state.delete_value("conversation.count")
        assert state.has_value("conversation.count") is False

    def test_invalid_path_too_many_dots(self, activity):
        state = TurnState(activity)
        with pytest.raises(ValueError, match="too many dots"):
            state.get_value("conversation.scope.key")

    def test_invalid_scope_name(self, activity):
        state = TurnState(activity)
        with pytest.raises(ValueError, match="Unknown scope"):
            state.get_value("invalid.key")

    def test_delete_conversation_state(self, activity):
        state = TurnState(activity)
        state.conversation.set("a", 1)
        state.conversation.set("b", 2)
        state.delete_conversation_state()
        assert state.conversation.has("a") is False
        assert state.conversation.has("b") is False

    def test_delete_user_state(self, activity):
        state = TurnState(activity)
        state.user.set("name", "Alice")
        state.delete_user_state()
        assert state.user.has("name") is False

    def test_delete_temp_state(self, activity):
        state = TurnState(activity)
        state.temp.set("input", "hello")
        state.delete_temp_state()
        assert state.temp.has("input") is False

    def test_derive_conversation_key(self, activity):
        key = TurnState.derive_conversation_key(activity)
        assert key == "msteams/bot-456/conversations/conv-789"

    def test_derive_user_key(self, activity):
        key = TurnState.derive_user_key(activity)
        assert key == "msteams/bot-456/users/user-123"
