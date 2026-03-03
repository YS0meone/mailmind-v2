/**
 * Client-side auth helpers.
 * Session is a JWT token stored in localStorage, issued by our backend
 * after Nylas Hosted Auth callback.
 */

const TOKEN_KEY = "mailmind_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

/**
 * Build the Nylas Hosted Auth URL.
 * Redirects the user to Nylas → Google → back to our callback page.
 */
export function getNylasAuthUrl(): string {
  const clientId = process.env.NEXT_PUBLIC_NYLAS_CLIENT_ID || "";
  const apiUri =
    process.env.NEXT_PUBLIC_NYLAS_API_URI || "https://api.us.nylas.com";
  const redirectUri = `${window.location.origin}/auth/callback`;

  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    response_type: "code",
    access_type: "online",
    provider: "google",
  });

  return `${apiUri}/v3/connect/auth?${params.toString()}`;
}
