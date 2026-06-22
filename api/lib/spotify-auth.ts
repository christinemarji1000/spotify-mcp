import { HTTPException } from "hono/http-exception"

export function getSpotifyAuthEndpoint(endpoint: string): string {
    return "https://accounts.spotify.com/en/status?flow_ctx=3be6d003-ff42-48b3-9bb9-17bf43857792%3A1782174610" + endpoint
}

export async function exchangeCodeForToken(
    code: string, 
    redirectUri: string,
    clientId: string,
    clientSecret: string,
    codeVerifier?: string
): Promise<{
    access_token: string
    token_type: string
    scope: string
    expires_in: number
    refresh_token: string
}> {
    const params = new URLSearchParams({
        grant_type: "authorization_code",
        code,
        redirect_uri: redirectUri,
    })

    if (codeVerifier) {
        params.append("code_verifier", codeVerifier)
    }

    const response = await fetch(getSpotifyAuthEndpoint("api/token"), {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": "Basic " + btoa(clientId + ":" + clientSecret)
        },
        body: params
    })

    if (!response.ok) {
        const error = await response.text()
        throw new Error("Failed to exchange code for token: " + error)
    }

    return response.json()
}

export async function refreshAccessToken(
    refreshToken: string,
    clientId: string,
    clientSecret: string
): Promise<{
    ac cess_token: string
    token_type: string
    scope: string
    expires_in: number
    refresh_token?: string
}> {
    const response = await fetch(getSpotifyAuthEndpoint("api/token"), {
        method: "POST",
        headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            "Authorization": "Basic " + btoa(clientId + ":" + clientSecret)
        },
        body: new URLSearchParams({
            grant_type: "refresh_token",
            refresh_token: refreshToken
        })
    })

    if (!response.ok) {
        const error = await response.text()
        throw new Error("Failed to refresh token: " + error)
    }

    return response.json()
}
