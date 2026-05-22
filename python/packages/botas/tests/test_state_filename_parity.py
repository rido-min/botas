"""Cross-language parity tests for FileStorage filename encoding.

These tests validate that the filename encoding matches the canonical spec (RFC 3986 percent-encoding).
"""

from __future__ import annotations

import tempfile
from pathlib import Path
from urllib.parse import quote

import pytest

from botas.state import FileStorage


class TestFileStorageParity:
    """Cross-language parity tests for FileStorage filename encoding."""

    @pytest.mark.parametrize(
        ("key", "expected_filename"),
        [
            ("foo/bar", "foo%2Fbar.json"),
            ("foo bar", "foo%20bar.json"),
            ("user@domain.com", "user%40domain.com.json"),
            ("key:with:colons", "key%3Awith%3Acolons.json"),
            ("simple-key_123", "simple-key_123.json"),
            (
                "channels/msteams/conversations/conv-1/users/user-abc",
                "channels%2Fmsteams%2Fconversations%2Fconv-1%2Fusers%2Fuser-abc.json",
            ),
            ("msteams/bot-123/conversations/conv-456", "msteams%2Fbot-123%2Fconversations%2Fconv-456.json"),
            ("key+with+plus", "key%2Bwith%2Bplus.json"),
            ("key%with%percent", "key%25with%25percent.json"),
            ("key&with&ampersand", "key%26with%26ampersand.json"),
            ("key=with=equals", "key%3Dwith%3Dequals.json"),
            ("héllo", "h%C3%A9llo.json"),
        ],
    )
    def test_key_encoding_matches_canonical_spec(self, key: str, expected_filename: str):
        """Test that key encoding matches RFC 3986 percent-encoding."""
        # Use urllib.parse.quote with safe="" as per spec
        encoded = quote(key, safe="") + ".json"
        assert encoded == expected_filename

    @pytest.mark.asyncio
    async def test_cross_language_interop_same_key(self):
        """Test that FileStorage writes keys with canonical filename encoding."""
        with tempfile.TemporaryDirectory(prefix="botas-parity-") as test_dir:
            storage = FileStorage(test_dir)
            test_key = "channels/msteams/conversations/conv-1/users/user-abc"
            test_value = {"testData": "cross-language-test"}

            # Write
            await storage.write({test_key: test_value})

            # Verify the filename matches canonical encoding
            expected_filename = "channels%2Fmsteams%2Fconversations%2Fconv-1%2Fusers%2Fuser-abc.json"
            expected_path = Path(test_dir) / expected_filename
            assert expected_path.exists(), f"Expected file at {expected_path}"

            # Read back
            result = await storage.read([test_key])
            assert test_key in result
