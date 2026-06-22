import { SpotifyMCP } from './SpotifyMCP.js'
import { spotifyBearerTokenAuthMiddleware, getSpotifyAuthEndpoint, exchangeCodeForToken, refreshAccessToken } from "./lib/spotify-auth.js";
import { cors } from "hono/cors";
import { Hono } from "hono";
import { handle } from 'hono/vercel';

export { SpotifyMCP };

type Bindings = {
  SPOTIFY_CLIENT_ID: string;
  SPOTIFY_CLIENT_SECRET: string;
}

const app = new Hono<{ Bindings: Bindings }>();

app.use(cors());

app.get('/.well-known/oauth-authorization-server', async (c) => {
  const url = new URL(c.req.url);
  return c.json({
    issuer: url.origin,
    authorization_endpoint: ${url.origin}/authorize,
    token_endpoint: ${url.origin}/token,
    registration_endpoint: ${url.origin}/register,
    response_types_supported: ['code'],
    response_modes_supported: ['query'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
    token_endpoint_auth_methods_supported: ['none'],
    code_challenge_methods_supported: ['S256'],
    scopes_supported: [
      'user-read-private', 'user-read-email', 'user-read-playback-state',
      'user-modify-playback-state', 'user-read-currently-playing',
      'user-read-recently-played', 'user-top-read', 'playlist-read-private',
      'playlist-read-collaborative', 'playlist-modify-public',
      'playlist-modify-private', 'user-library-read', 'user-library-modify'
    ],
  });
});

app.get('/authorize', async (c) => {
  const url = new URL(c.req.url);
  const spotifyAuthUrl = new URL(getSpotifyAuthEndpoint('authorize'));
  url.searchParams.forEach((value, key) => {
    if (key !== 'client_id') {
      spotifyAuthUrl.searchParams.set(key, value);
    }
  });
  spotifyAuthUrl.searchParams.set('client_id', c.env.SPOTIFY_CLIENT_ID);
  return c.redirect(spotifyAuthUrl.toString());
});

app.post('/token', async (c) => {
  const body = await c.req.parseBody();
  if (body.grant_type === 'authorization_code') {
    const result = await exchangeCodeForToken(
      body.code as string,
      body.redirect_uri as string,
      c.env.SPOTIFY_CLIENT_ID,
      c.env.SPOTIFY_CLIENT_SECRET,
      body.code_verifier as string | undefined
    );
    return c.json(result);

} else if (body.grant_type === 'refresh_token') {
    const result = await refreshAccessToken(
      body.refresh_token as string,
      c.env.SPOTIFY_CLIENT_ID,
      c.env.SPOTIFY_CLIENT_SECRET
    );
    return c.json(result);
  }
  return c.json({ error: 'unsupported_grant_type' }, 400);
});

app.use('/sse/*', spotifyBearerTokenAuthMiddleware);
app.route('/sse', new Hono().mount('/', SpotifyMCP.serveSSE('/sse', { binding: 'SPOTIFY_MCP_OBJECT' }).fetch));
app.use('/mcp', spotifyBearerTokenAuthMiddleware);
app.route('/mcp', new Hono().mount('/', SpotifyMCP.serve('/mcp', { binding: 'SPOTIFY_MCP_OBJECT' }).fetch));

app.get('/', (c) => c.text('Spotify MCP Server is running'));

export const GET = handle(app);
export const POST = handle(app);
export const PUT = handle(app);
export const DELETE = handle(app);
