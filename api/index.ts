import { spotifyBearerTokenAuthMiddleware, getSpotifyAuthEndpoint, exchangeCodeForToken, refreshAccessToken } from "./lib/spotify-auth.js"
import { createSpotifyMCPServer } from './SpotifyMCP.js'
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js"
import { cors } from "hono/cors"
import { Hono } from "hono"
import { handle } from 'hono/vercel'

type Bindings = {
  SPOTIFY_CLIENT_ID: string
  SPOTIFY_CLIENT_SECRET: string
}

const app = new Hono<{ Bindings: Bindings }>()

app.use(cors())

app.get('/.well-known/oauth-authorization-server', async (c) => {
  const url = new URL(c.req.url)
  return c.json({
    issuer: url.origin,
    authorization_endpoint: ${url.origin}/authorize,
    token_endpoint: ${url.origin}/token,
    response_types_supported: ['code'],
    grant_types_supported: ['authorization_code', 'refresh_token'],
  })
})

app.get('/authorize', async (c) => {
  const spotifyAuthUrl = new URL(getSpotifyAuthEndpoint('authorize'))
  const url = new URL(c.req.url)
  url.searchParams.forEach((v, k) => { if (k !== 'client_id') spotify AuthUrl.searchParams.set(k, v) })
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

app.get('/sse', spotifyBearerTokenAuthMiddleware, async (c) => {
  const transport = new SSEServerTransport("/message", c.res as any)
  const accessToken = c.get('spotifyAccessToken')
  
  const mcpServer = createSpotifyMCPServer(process.env, accessToken)
  await mcpServer.connect(transport)

  return new Response(null, { status: 200 })
})

app.post('/message', async (c) => {
  return c.json({ message: "Message received" })
})

app.get('/', (c) => c.text('Spotify MCP Server is ru nning'))

export const GET = handle(app)
export const POST = handle(app)
