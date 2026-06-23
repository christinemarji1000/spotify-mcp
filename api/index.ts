import { getSpotifyAuthEndpoint, exchangeCodeForToken, refreshAccessToken } from "./lib/spotify-auth.js"
import { createSpotifyMCPServer } from './SpotifyMCP.js'
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

app.use('*', cors({
  origin: '*',
  allowMethods: ['GET', 'POST', 'OPTIONS'],
  allowHeaders: ['Content-Type', 'Authorization', 'X-Poke-Validator'],
  exposeHeaders: ['Content-Length'],
  maxAge: 600,
  credentials: true,
}))
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
  spotifyAuthUrl.searchParams.set('response_type', 'code')
  if (!spotifyAuthUrl.searchParams.has('redirect_uri')) {
  spotifyAuthUrl.searchParams.set('redirect_uri', process.env.SPOTIFY_REDIRECT_URL!)
}
  return c.redirect(spotifyAuthUrl.toString())
})

app.get('/callback', (c) => {
  return c.html(`
    
      <h1 style="color: #1DB954;">Successfully Authorized!
      <p>You can now close this window and return to Poke.
    
  `)
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

const transports = new Map<string, any>()

app.get('/sse', async (c) => {
  c.header('X-Accel-Buffering', 'no')
  c.header('Content-Type', 'text/event-stream')
  c.header('Cache-Control', 'no-cache')

  return streamSSE(c, async (stream) => {
    const authHeader = c.req.header('Authorization')
    const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : ""
    
    const transport = new SSEServerTransport("/message", stream as any)
    transports.set(transport.sessionId, transport)

    const mcpServer = createSpotifyMCPServer(process.env, accessToken)
    await mcpServer.connect(transport)

    stream.onAbort(() => {
      transports.delete(transport.sessionId)
    })

    while (true) {
      await stream.sleep(30000)
    }
  })
})

app.post('/message', async (c) => {
  const sessionId = c.req.query('sessionId')
  const transport = sessionId ? transports.get(sessionId) : null

  if (transport) {
    await transport.handlePostMessage(c.req.raw as any, c.res.raw as any)
    return c.json({ status: "accepted" })
  }

  // Stateless Fallback for Vercel/HTTP registration
  const authHeader = c.req.header('Authorization')
  const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : ""
  const mcpServer = createSpotifyMCPServer(process.env, accessToken)
  const body = await c.req.json()
  const response = await mcpServer.handleRequest(body)
  return c.json(

app.get('/', (c) => c.text('Spotify MCP Server is running'))

export const GET = handle(app)
export const POST = handle(app)
export const OPTIONS = handle(app)
