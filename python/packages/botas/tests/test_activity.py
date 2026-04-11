import pytest
from botas.schema.activity import Activity, ChannelAccount, create_reply_activity


def _base_activity(**kwargs) -> Activity:
    data = {
        "type": "message",
        "channelId": "msteams",
        "serviceUrl": "http://service.url",
        "from": {"id": "user1", "name": "User One"},
        "recipient": {"id": "bot1", "name": "Bot One"},
        "conversation": {"id": "conv1"},
        "text": "hello",
        "id": "act1",
    }
    data.update(kwargs)
    return Activity.model_validate(data)


class TestActivityDeserialization:
    def test_parses_known_fields(self):
        act = Activity.model_validate_json('{"type":"message","channelId":"msteams","serviceUrl":"http://s","from":{"id":"u1","name":"User"},"recipient":{"id":"b1"},"conversation":{"id":"c1"},"text":"hello"}')
        assert act.type == "message"
        assert act.channel_id == "msteams"
        assert act.service_url == "http://s"
        assert act.text == "hello"
        assert act.from_account is not None
        assert act.from_account.id == "u1"
        assert act.from_account.name == "User"

    def test_handles_null_text(self):
        act = Activity.model_validate_json('{"type":"message","serviceUrl":"http://s","channelId":"c","from":{"id":"u"},"recipient":{"id":"b"},"conversation":{"id":"c"},"text":null}')
        assert act.type == "message"
        assert act.text is None

    def test_handles_missing_optional_fields(self):
        act = Activity.model_validate_json('{"type":"message","serviceUrl":"http://s","channelId":"c","from":{"id":"u"},"recipient":{"id":"b"},"conversation":{"id":"c"}}')
        assert act.text is None
        assert act.id is None

    def test_aad_object_id_as_typed_property(self):
        act = Activity.model_validate_json('{"type":"message","serviceUrl":"http://s","channelId":"c","from":{"id":"1","name":"tester","aadObjectId":"123"},"recipient":{"id":"b"},"conversation":{"id":"c"},"text":"hello"}')
        assert act.from_account is not None
        assert act.from_account.id == "1"
        assert act.from_account.name == "tester"
        assert act.from_account.aad_object_id == "123"

    def test_role_as_typed_property(self):
        act = Activity.model_validate_json('{"type":"message","serviceUrl":"http://s","channelId":"c","from":{"id":"1","role":"user"},"recipient":{"id":"b"},"conversation":{"id":"c"}}')
        assert act.from_account is not None
        assert act.from_account.role == "user"

    def test_extra_fields_preserved_in_model_extra(self):
        act = Activity.model_validate_json('{"type":"message","serviceUrl":"http://s","channelId":"c","from":{"id":"u"},"recipient":{"id":"b"},"conversation":{"id":"c"},"unknownField":"surprise"}')
        assert act.model_extra.get("unknownField") == "surprise"


class TestCreateReplyActivity:
    def setup_method(self):
        self.incoming = _base_activity()

    def test_type_is_message(self):
        reply = create_reply_activity(self.incoming, "reply")
        assert reply["type"] == "message"

    def test_copies_channel_id_service_url_conversation(self):
        reply = create_reply_activity(self.incoming, "reply")
        assert reply["channelId"] == "msteams"
        assert reply["serviceUrl"] == "http://service.url"
        assert reply["conversation"]["id"] == "conv1"

    def test_swaps_from_and_recipient(self):
        reply = create_reply_activity(self.incoming, "reply")
        assert reply["from"]["id"] == "bot1"
        assert reply["from"]["name"] == "Bot One"
        assert reply["recipient"]["id"] == "user1"
        assert reply["recipient"]["name"] == "User One"

    def test_sets_reply_to_id(self):
        reply = create_reply_activity(self.incoming, "reply")
        assert reply["replyToId"] == "act1"

    def test_sets_text(self):
        reply = create_reply_activity(self.incoming, "you said: hello")
        assert reply["text"] == "you said: hello"

    def test_default_text_is_empty_string(self):
        reply = create_reply_activity(self.incoming)
        assert reply["text"] == ""
