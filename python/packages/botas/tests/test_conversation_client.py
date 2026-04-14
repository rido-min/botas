from botas.conversation_client import _encode_conversation_id, _encode_path


class TestEncodePath:
    def test_encodes_slash(self):
        assert _encode_path("act/123") == "act%2F123"

    def test_encodes_question_mark(self):
        assert _encode_path("act?foo=bar") == "act%3Ffoo%3Dbar"

    def test_encodes_hash(self):
        assert _encode_path("act#frag") == "act%23frag"

    def test_encodes_percent(self):
        assert _encode_path("100%done") == "100%25done"

    def test_plain_value_unchanged(self):
        assert _encode_path("simple-id_123") == "simple-id_123"

    def test_encodes_space(self):
        assert _encode_path("has space") == "has%20space"


class TestEncodeConversationId:
    def test_truncates_semicolon_and_encodes(self):
        assert _encode_conversation_id("conv;extra") == "conv"

    def test_encodes_special_chars(self):
        assert _encode_conversation_id("conv/id") == "conv%2Fid"

    def test_plain_value_unchanged(self):
        assert _encode_conversation_id("conv123") == "conv123"

    def test_uses_encode_path_internally(self):
        result = _encode_conversation_id("a/b;c/d")
        assert result == "a%2Fb"
