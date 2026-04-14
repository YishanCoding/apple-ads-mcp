import { importPKCS8, SignJWT } from "jose";
const TOKEN_URL = "https://appleid.apple.com/auth/oauth2/token";
const TOKEN_EXPIRY_BUFFER_MS = 300_000; // refresh 5 min before expiry
let tokenCache = null;
export async function getAccessToken(config) {
    if (tokenCache && Date.now() < tokenCache.expiresAt - TOKEN_EXPIRY_BUFFER_MS) {
        return tokenCache.accessToken;
    }
    const clientSecret = await generateClientSecret(config);
    const body = new URLSearchParams({
        grant_type: "client_credentials",
        client_id: config.clientId,
        client_secret: clientSecret,
        scope: "searchadsorg",
    });
    const response = await fetch(TOKEN_URL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
    });
    if (!response.ok) {
        const text = await response.text();
        throw new Error(`Token request failed (${response.status}): ${text}`);
    }
    const data = (await response.json());
    tokenCache = {
        accessToken: data.access_token,
        expiresAt: Date.now() + data.expires_in * 1000,
    };
    console.error("[auth] Access token obtained, expires in", data.expires_in, "seconds");
    return tokenCache.accessToken;
}
async function generateClientSecret(config) {
    const privateKey = await importPKCS8(config.privateKey, "ES256");
    const now = Math.floor(Date.now() / 1000);
    const jwt = await new SignJWT({})
        .setProtectedHeader({ alg: "ES256", kid: config.keyId })
        .setIssuer(config.teamId)
        .setSubject(config.clientId)
        .setAudience("https://appleid.apple.com")
        .setIssuedAt(now)
        .setExpirationTime(now + 3600)
        .sign(privateKey);
    return jwt;
}
//# sourceMappingURL=oauth.js.map