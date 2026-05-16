"""Tests for AgentTokenClient and AgenticIdentity."""

from unittest.mock import AsyncMock

import httpx
import pytest

from botas.agent_token_client import AgenticIdentity, AgentTokenClient


class TestAgenticIdentity:
    """Tests for the AgenticIdentity.from_conversation factory."""

    def test_returns_identity_when_fields_present(self):
        class FakeConv:
            agentic_app_id = "agent-app-id"
            agentic_user_id = "user-oid"
            agentic_app_blueprint_id = "blueprint-id"

        identity = AgenticIdentity.from_conversation(FakeConv())
        assert identity is not None
        assert identity.agentic_app_id == "agent-app-id"
        assert identity.agentic_user_id == "user-oid"
        assert identity.agentic_app_blueprint_id == "blueprint-id"

    def test_returns_none_when_conversation_is_none(self):
        assert AgenticIdentity.from_conversation(None) is None

    def test_returns_none_when_app_id_missing(self):
        class FakeConv:
            agentic_app_id = None
            agentic_user_id = "user-oid"

        assert AgenticIdentity.from_conversation(FakeConv()) is None

    def test_returns_none_when_user_id_missing(self):
        class FakeConv:
            agentic_app_id = "agent-app-id"
            agentic_user_id = None

        assert AgenticIdentity.from_conversation(FakeConv()) is None

    def test_returns_none_when_fields_absent(self):
        class FakeConv:
            pass

        assert AgenticIdentity.from_conversation(FakeConv()) is None

    def test_blueprint_id_is_optional(self):
        class FakeConv:
            agentic_app_id = "agent-app-id"
            agentic_user_id = "user-oid"

        identity = AgenticIdentity.from_conversation(FakeConv())
        assert identity is not None
        assert identity.agentic_app_blueprint_id is None


class TestAgentTokenClient:
    """Tests for the 3-step token exchange flow."""

    @pytest.fixture
    def client(self):
        return AgentTokenClient("tenant-123", "blueprint-client-id", "blueprint-secret")

    def _mock_response(self, token: str) -> httpx.Response:
        return httpx.Response(200, json={"access_token": token})

    def _mock_error_response(self) -> httpx.Response:
        return httpx.Response(400, json={"error": "invalid_grant", "error_description": "bad request"})

    @pytest.mark.asyncio
    async def test_three_step_flow_success(self, client: AgentTokenClient):
        """Verify the 3-step exchange calls the token endpoint 3 times with correct params."""
        responses = [
            self._mock_response("t1-fmi-token"),
            self._mock_response("t2-impersonation-token"),
            self._mock_response("final-resource-token"),
        ]
        call_index = 0

        async def mock_post(url, *, data, headers):
            nonlocal call_index
            resp = responses[call_index]
            call_index += 1
            return resp

        client._http = AsyncMock()
        client._http.post = mock_post

        result = await client.get_agent_user_token("agent-id", "user-oid", "https://api.botframework.com/.default")

        assert result == "Bearer final-resource-token"
        assert call_index == 3

    @pytest.mark.asyncio
    async def test_step1_params(self, client: AgentTokenClient):
        """Verify step 1 sends correct params (client_credentials + fmi_path)."""
        captured_params: list[dict] = []

        async def mock_post(url, *, data, headers):
            captured_params.append(data)
            return self._mock_response(f"token-{len(captured_params)}")

        client._http = AsyncMock()
        client._http.post = mock_post

        await client.get_agent_user_token("agent-id", "user-oid", "scope")

        step1 = captured_params[0]
        assert step1["grant_type"] == "client_credentials"
        assert step1["client_id"] == "blueprint-client-id"
        assert step1["client_secret"] == "blueprint-secret"
        assert step1["fmi_path"] == "agent-id"
        assert step1["scope"] == "api://AzureADTokenExchange/.default"

    @pytest.mark.asyncio
    async def test_step2_params(self, client: AgentTokenClient):
        """Verify step 2 sends T1 as client_assertion with agent_identity_id as client_id."""
        captured_params: list[dict] = []

        async def mock_post(url, *, data, headers):
            captured_params.append(data)
            return self._mock_response(f"token-{len(captured_params)}")

        client._http = AsyncMock()
        client._http.post = mock_post

        await client.get_agent_user_token("agent-id", "user-oid", "scope")

        step2 = captured_params[1]
        assert step2["grant_type"] == "client_credentials"
        assert step2["client_id"] == "agent-id"
        assert step2["client_assertion"] == "token-1"
        assert step2["client_assertion_type"] == "urn:ietf:params:oauth:client-assertion-type:jwt-bearer"

    @pytest.mark.asyncio
    async def test_step3_params(self, client: AgentTokenClient):
        """Verify step 3 sends user_fic grant with T1, T2, and user_id."""
        captured_params: list[dict] = []

        async def mock_post(url, *, data, headers):
            captured_params.append(data)
            return self._mock_response(f"token-{len(captured_params)}")

        client._http = AsyncMock()
        client._http.post = mock_post

        await client.get_agent_user_token("agent-id", "user-oid", "https://resource/.default")

        step3 = captured_params[2]
        assert step3["grant_type"] == "user_fic"
        assert step3["client_id"] == "agent-id"
        assert step3["client_assertion"] == "token-1"
        assert step3["user_federated_identity_credential"] == "token-2"
        assert step3["user_id"] == "user-oid"
        assert step3["requested_token_use"] == "on_behalf_of"
        assert step3["scope"] == "https://resource/.default"

    @pytest.mark.asyncio
    async def test_caching_skips_http_calls(self, client: AgentTokenClient):
        """Verify cached tokens are returned without making HTTP calls."""
        call_count = 0

        async def mock_post(url, *, data, headers):
            nonlocal call_count
            call_count += 1
            return self._mock_response(f"token-{call_count}")

        client._http = AsyncMock()
        client._http.post = mock_post

        result1 = await client.get_agent_user_token("agent-id", "user-oid", "scope")
        result2 = await client.get_agent_user_token("agent-id", "user-oid", "scope")

        assert result1 == result2
        assert call_count == 3  # Only 3 calls from first invocation

    @pytest.mark.asyncio
    async def test_different_cache_keys_make_separate_calls(self, client: AgentTokenClient):
        """Verify different agent/user combinations get separate tokens."""
        call_count = 0

        async def mock_post(url, *, data, headers):
            nonlocal call_count
            call_count += 1
            return self._mock_response(f"token-{call_count}")

        client._http = AsyncMock()
        client._http.post = mock_post

        await client.get_agent_user_token("agent-1", "user-1", "scope")
        await client.get_agent_user_token("agent-2", "user-2", "scope")

        assert call_count == 6  # 3 calls per unique combination

    @pytest.mark.asyncio
    async def test_error_raises_runtime_error(self, client: AgentTokenClient):
        """Verify HTTP errors raise RuntimeError with details."""

        async def mock_post(url, *, data, headers):
            return self._mock_error_response()

        client._http = AsyncMock()
        client._http.post = mock_post

        with pytest.raises(RuntimeError, match="invalid_grant"):
            await client.get_agent_user_token("agent-id", "user-oid", "scope")

    @pytest.mark.asyncio
    async def test_expired_cache_refetches(self, client: AgentTokenClient):
        """Verify expired cache entries trigger new token requests."""
        call_count = 0

        async def mock_post(url, *, data, headers):
            nonlocal call_count
            call_count += 1
            return self._mock_response(f"token-{call_count}")

        client._http = AsyncMock()
        client._http.post = mock_post

        await client.get_agent_user_token("agent-id", "user-oid", "scope")
        assert call_count == 3

        # Expire the cache
        for entry in client._cache.values():
            entry.expires_at = 0

        await client.get_agent_user_token("agent-id", "user-oid", "scope")
        assert call_count == 6  # 3 more calls for refetch

    @pytest.mark.asyncio
    async def test_token_endpoint_url(self, client: AgentTokenClient):
        """Verify the token endpoint uses the correct tenant."""
        captured_urls: list[str] = []

        async def mock_post(url, *, data, headers):
            captured_urls.append(url)
            return self._mock_response("token")

        client._http = AsyncMock()
        client._http.post = mock_post

        await client.get_agent_user_token("agent-id", "user-oid", "scope")

        assert all(url == "https://login.microsoftonline.com/tenant-123/oauth2/v2.0/token" for url in captured_urls)
