from botas.core_activity import CoreActivity, CoreActivityBuilder


def _base_activity(**kwargs) -> CoreActivity:
    data = {
        "type": "message",
        "serviceUrl": "http://service.url",
        "from": {"id": "user1", "name": "User One"},
        "recipient": {"id": "bot1", "name": "Bot One"},
        "conversation": {"id": "conv1"},
        "text": "hello",
    }
    data.update(kwargs)
    return CoreActivity.model_validate(data)


class TestActivityDeserialization:
    def test_parses_known_fields(self):
        act = CoreActivity.model_validate_json(
            '{"type":"message","serviceUrl":"http://s","from":{"id":"u1","name":"User"},"recipient":{"id":"b1"},"conversation":{"id":"c1"},"text":"hello"}'
        )
        assert act.type == "message"
        assert act.service_url == "http://s"
        assert act.text == "hello"
        assert act.from_account is not None
        assert act.from_account.id == "u1"
        assert act.from_account.name == "User"

    def test_handles_null_text(self):
        act = CoreActivity.model_validate_json(
            '{"type":"message","serviceUrl":"http://s","from":{"id":"u"},"recipient":{"id":"b"},"conversation":{"id":"c"},"text":null}'
        )
        assert act.type == "message"
        assert act.text is None

    def test_handles_missing_optional_fields(self):
        act = CoreActivity.model_validate_json(
            '{"type":"message","serviceUrl":"http://s","from":{"id":"u"},"recipient":{"id":"b"},"conversation":{"id":"c"}}'
        )
        assert act.text is None

    def test_aad_object_id_as_typed_property(self):
        act = CoreActivity.model_validate_json(
            '{"type":"message","serviceUrl":"http://s","from":{"id":"1","name":"tester","aadObjectId":"123"},"recipient":{"id":"b"},"conversation":{"id":"c"},"text":"hello"}'
        )
        assert act.from_account is not None
        assert act.from_account.id == "1"
        assert act.from_account.name == "tester"
        assert act.from_account.aad_object_id == "123"

    def test_role_as_typed_property(self):
        act = CoreActivity.model_validate_json(
            '{"type":"message","serviceUrl":"http://s","from":{"id":"1","role":"user"},"recipient":{"id":"b"},"conversation":{"id":"c"}}'
        )
        assert act.from_account is not None
        assert act.from_account.role == "user"

    def test_extra_fields_preserved_in_model_extra(self):
        act = CoreActivity.model_validate_json(
            '{"type":"message","serviceUrl":"http://s","from":{"id":"u"},"recipient":{"id":"b"},"conversation":{"id":"c"},"unknownField":"surprise"}'
        )
        assert act.model_extra.get("unknownField") == "surprise"

    def test_untyped_fields_land_in_model_extra(self):
        act = CoreActivity.model_validate_json(
            '{"type":"message","serviceUrl":"http://s","channelId":"msteams","id":"act1","from":{"id":"u"},"recipient":{"id":"b"},"conversation":{"id":"c"},"customThing":"val"}'
        )
        assert act.model_extra.get("customThing") == "val"

    def test_id_and_channel_id_deserialize_as_typed_fields(self):
        act = CoreActivity.model_validate_json(
            '{"type":"message","serviceUrl":"http://s","id":"act1","channelId":"msteams","from":{"id":"u"},"recipient":{"id":"b"},"conversation":{"id":"c"}}'
        )
        assert act.id == "act1"
        assert act.channel_id == "msteams"

    def test_id_and_channel_id_not_in_extra(self):
        act = CoreActivity.model_validate_json(
            '{"type":"message","serviceUrl":"http://s","id":"act1","channelId":"msteams","from":{"id":"u"},"recipient":{"id":"b"},"conversation":{"id":"c"}}'
        )
        assert "id" not in (act.model_extra or {})
        assert "channelId" not in (act.model_extra or {})

    def test_id_and_channel_id_serialize_back(self):
        act = CoreActivity.model_validate_json(
            '{"type":"message","serviceUrl":"http://s","id":"act1","channelId":"msteams","from":{"id":"u"},"recipient":{"id":"b"},"conversation":{"id":"c"}}'
        )
        d = act.model_dump(by_alias=True)
        assert d["id"] == "act1"
        assert d["channelId"] == "msteams"

    def test_id_and_channel_id_round_trip(self):

        original = '{"type":"message","serviceUrl":"http://s","id":"act1","channelId":"msteams","from":{"id":"u"},"recipient":{"id":"b"},"conversation":{"id":"c"},"text":"hi"}'
        act = CoreActivity.model_validate_json(original)
        d = act.model_dump(by_alias=True)
        assert d["id"] == "act1"
        assert d["channelId"] == "msteams"
        act2 = CoreActivity.model_validate(d)
        assert act2.id == "act1"
        assert act2.channel_id == "msteams"

    def test_id_and_channel_id_default_to_none(self):
        act = CoreActivity.model_validate_json(
            '{"type":"message","serviceUrl":"http://s","from":{"id":"u"},"recipient":{"id":"b"},"conversation":{"id":"c"}}'
        )
        assert act.id is None
        assert act.channel_id is None


class TestCoreActivityBuilder:
    def setup_method(self):
        self.incoming = _base_activity()

    def test_type_is_message(self):
        reply = CoreActivityBuilder().with_conversation_reference(self.incoming).with_text("reply").build()
        assert reply.type == "message"

    def test_copies_service_url_and_conversation(self):
        reply = CoreActivityBuilder().with_conversation_reference(self.incoming).with_text("reply").build()
        assert reply.service_url == "http://service.url"
        assert reply.conversation is not None
        assert reply.conversation.id == "conv1"

    def test_swaps_from_and_recipient(self):
        reply = CoreActivityBuilder().with_conversation_reference(self.incoming).with_text("reply").build()
        assert reply.from_account is not None
        assert reply.from_account.id == "bot1"
        assert reply.from_account.name == "Bot One"
        assert reply.recipient is not None
        assert reply.recipient.id == "user1"
        assert reply.recipient.name == "User One"

    def test_sets_text(self):
        reply = CoreActivityBuilder().with_conversation_reference(self.incoming).with_text("you said: hello").build()
        assert reply.text == "you said: hello"

    def test_default_text_is_empty_string(self):
        reply = CoreActivityBuilder().with_conversation_reference(self.incoming).build()
        assert reply.text == ""

    def test_build_returns_copy(self):
        builder = CoreActivityBuilder().with_conversation_reference(self.incoming)
        a = builder.with_text("first").build()
        b = builder.with_text("second").build()
        assert a.text == "first"
        assert b.text == "second"

    def test_returns_core_activity_instance(self):
        reply = CoreActivityBuilder().with_conversation_reference(self.incoming).with_text("hi").build()
        assert isinstance(reply, CoreActivity)
