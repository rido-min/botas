import asyncio
from unittest.mock import AsyncMock, patch

import pytest

import botas.bot_auth as bot_auth


@pytest.fixture(autouse=True)
def _reset_jwks_state():
    """Reset module-level JWKS cache between tests."""
    bot_auth._jwks_uri = None
    bot_auth._jwks_keys = []
    bot_auth._jwks_generation = 0
    bot_auth._jwks_lock = asyncio.Lock()
    yield
    bot_auth._jwks_uri = None
    bot_auth._jwks_keys = []
    bot_auth._jwks_generation = 0
    bot_auth._jwks_lock = asyncio.Lock()


class TestGetJwksCoalescing:
    async def test_concurrent_force_refresh_fetches_once(self):
        """Multiple concurrent force_refresh=True calls should result in only one HTTP fetch."""
        fake_keys = [{"kid": "k1", "kty": "RSA"}]
        fetch_count = 0

        async def _mock_fetch_jwks(uri: str):
            nonlocal fetch_count
            fetch_count += 1
            await asyncio.sleep(0.05)
            return fake_keys

        with (
            patch.object(bot_auth, "_fetch_jwks_uri", new_callable=AsyncMock, return_value="https://jwks.example.com"),
            patch.object(bot_auth, "_fetch_jwks", side_effect=_mock_fetch_jwks),
        ):
            # Initial load to populate the cache
            await bot_auth._get_jwks()
            assert fetch_count == 1

            # Fire N concurrent force_refresh calls
            results = await asyncio.gather(
                bot_auth._get_jwks(force_refresh=True),
                bot_auth._get_jwks(force_refresh=True),
                bot_auth._get_jwks(force_refresh=True),
                bot_auth._get_jwks(force_refresh=True),
                bot_auth._get_jwks(force_refresh=True),
            )

            # Only one additional fetch should have happened
            assert fetch_count == 2
            for r in results:
                assert r == fake_keys

    async def test_initial_load_fetches_once(self):
        """Multiple concurrent initial loads should result in only one HTTP fetch."""
        fake_keys = [{"kid": "k1", "kty": "RSA"}]
        fetch_count = 0

        async def _mock_fetch_jwks(uri: str):
            nonlocal fetch_count
            fetch_count += 1
            await asyncio.sleep(0.05)
            return fake_keys

        with (
            patch.object(bot_auth, "_fetch_jwks_uri", new_callable=AsyncMock, return_value="https://jwks.example.com"),
            patch.object(bot_auth, "_fetch_jwks", side_effect=_mock_fetch_jwks),
        ):
            results = await asyncio.gather(
                bot_auth._get_jwks(),
                bot_auth._get_jwks(),
                bot_auth._get_jwks(),
            )
            assert fetch_count == 1
            for r in results:
                assert r == fake_keys

    async def test_non_refresh_returns_cached(self):
        """Non-refresh calls return cached keys without acquiring the lock."""
        fake_keys = [{"kid": "k1", "kty": "RSA"}]

        with (
            patch.object(bot_auth, "_fetch_jwks_uri", new_callable=AsyncMock, return_value="https://jwks.example.com"),
            patch.object(bot_auth, "_fetch_jwks", new_callable=AsyncMock, return_value=fake_keys),
        ):
            await bot_auth._get_jwks()
            result = await bot_auth._get_jwks()
            assert result == fake_keys
            # _fetch_jwks should only have been called once
            bot_auth._fetch_jwks.assert_called_once()

    async def test_generation_increments_on_refresh(self):
        """Each actual fetch should increment the generation counter."""
        fake_keys = [{"kid": "k1", "kty": "RSA"}]

        with (
            patch.object(bot_auth, "_fetch_jwks_uri", new_callable=AsyncMock, return_value="https://jwks.example.com"),
            patch.object(bot_auth, "_fetch_jwks", new_callable=AsyncMock, return_value=fake_keys),
        ):
            assert bot_auth._jwks_generation == 0
            await bot_auth._get_jwks()
            assert bot_auth._jwks_generation == 1
            await bot_auth._get_jwks(force_refresh=True)
            assert bot_auth._jwks_generation == 2
