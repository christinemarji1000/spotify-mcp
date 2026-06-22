import { spotifyBearerTokenAuthMiddleware, getSpotifyAuthEndpoint, exchangeCodeForToken, refreshAccessToken } from "./lib/spotify-auth"
import { createSpotifyMCPServer } from './SpotifyMCP'
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js"
import { cors } from "hono/cors"
import { Hono } from "hono"
import { handle } from 'hono/vercel'
import { streamSSE } from 'hono/streaming'

type Bindings = {
  SPOTIFY_CLIENT_ID: string
  SPOTIFY_CLIENT_SECRET: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.use(cors())
app.get('/health', (c) => {
  return c.json({ status: "ok" })
  })

app.get('/.well-known/oauth-authorization-server', async (c) => {
  const url = new URL(c.req.url)
  return c.json({
    issuer: url.origin,
    authorization_endpoint: `${url.origin}/authorize`,
    token_endpoint: `${url.origin}/token`,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
  })
})

app.get('/authorize', async (c) => {
  const spotifyAuthUrl = new URL(getSpotifyAuthEndpoint('authorize'))
  const url = new URL(c.req.url)
  url.searchParams.forEach((v, k) => {
    if (k !== 'client_id') spotifyAuthUrl.searchParams.set(k, v)
  })
  spotifyAuthUrl.searchParams.set('client_id', process.env.SPOTIFY_CLIENT_ID!)
  return c.redirect(spotifyAuthUrl.toString())
})

app.post('/token', async (c) => {
  const body = await c.req.parseBody()
  const clientId = process.env.SPOTIFY_CLIENT_ID!
  const clientSecret = process.env.SPOTIFY_CLIENT_SECRET!

  if (body.grant_type === 'authorization_code') {
    const result = await exchangeCodeForToken(body.code as string, body.redirect_uri as string, clientId, clientSecret, body.code_verifier as string)
    return c.json(result)
  } else if (body.grant_type === 'refresh_token') {
    const result = await refreshAccessToken(body.refresh_token as string, clientId, clientSecret)
    return c.json(result)
  }
  return c.json({ error: 'unsupported_grant_type' }, 400)
})

app.get('/sse', async (c, next) => {
  if (!c.req.header('Authorization')) {
    return streamSSE(c, async (stream) => {
      await stream.writeSSE({ event: 'heartbeat', data: 'x'.repeat(1024) });
      const transport = new SSEServerTransport("/message", stream as any);
      const mcpServer = createSpotifyMCPServer(process.env, "");
      await mcpServer.connect(transport);
      while (true) { await stream.sleep(1000); }
    });
  }
  
  return spotifyBearerTokenAuthMiddleware(c, async () => {
    return streamSSE(c, async (stream) => {
      await stream.writeSSE({ event: 'heartbeat', data: 'x'.repeat(1024) });
      const accessToken = c.get('spotifyAccessToken');
      const transport = new SSEServerTransport("/message", stream as any);
      const mcpServer = createSpotifyMCPServer(process.env, accessToken);
      await mcpServer.connect(transport);
      while (true) { await stream.sleep(1000); }
    });
  })(c, next);
})
app.post('/message', async (c) => {
  return c.json({ message: "Message received" })
})

app.get('/', (c) => c.text('Spotify MCP Server is running'))

export const GET = handle(app)
export const POST = handle(app)
