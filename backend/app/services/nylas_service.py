import httpx

from app.config import settings


class NylasService:
    """Wrapper around Nylas v3 API for Hosted Auth and email operations."""

    def __init__(self):
        self.api_uri = settings.nylas_api_uri
        self.api_key = settings.nylas_api_key
        self.client_id = settings.nylas_client_id

    def _headers(self) -> dict:
        return {
            "Authorization": f"Bearer {self.api_key}",
            "Content-Type": "application/json",
            "Accept": "application/json",
        }

    async def exchange_code_for_grant(self, code: str, redirect_uri: str) -> dict:
        """Exchange a Nylas Hosted Auth authorization code for a grant.

        Returns grant_id and email from the token exchange response.
        """
        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.api_uri}/v3/connect/token",
                headers=self._headers(),
                json={
                    "client_id": self.client_id,
                    "client_secret": self.api_key,
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": redirect_uri,
                },
                timeout=30.0,
            )
            if response.status_code != 200:
                raise Exception(f"Nylas token exchange error ({response.status_code}): {response.text}")
            data = response.json()
            return {
                "grant_id": data["grant_id"],
                "email": data.get("email", ""),
            }

    async def list_messages(self, grant_id: str, limit: int = 10) -> list[dict]:
        """Fetch recent messages for a grant (for verification)."""
        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.api_uri}/v3/grants/{grant_id}/messages",
                headers=self._headers(),
                params={"limit": limit},
                timeout=30.0,
            )
            response.raise_for_status()
            return response.json()["data"]

    async def revoke_grant(self, grant_id: str) -> None:
        """Revoke/delete a Nylas grant."""
        async with httpx.AsyncClient() as client:
            response = await client.delete(
                f"{self.api_uri}/v3/grants/{grant_id}",
                headers=self._headers(),
                timeout=30.0,
            )
            response.raise_for_status()


nylas_service = NylasService()
