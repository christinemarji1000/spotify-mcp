import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import { SpotifyService } from './SpotifyService.js'

export function createSpotifyMCPServer(env: any, accessToken: string, refreshToken?: string) {
  const spotifyService = new SpotifyService(env, accessToken, refreshToken)

  const formatResponse = (description: string, data: unknown) => {
    return {
      content: [
        {
          type: "text",
          text: `Success! ${description}\n\nResult:\n${JSON.stringify(data, null, 2)}`
        }
      ]
    }
  }

  const server = new McpServer({
    name: 'Spotify Service',
    version: '1.0.0',
  })

  server.tool('searchTracks', 'Search for tracks on Spotify', {
    query: z.string().describe('Search query for tracks'),
    limit: z.number().optional().default(20).describe('Maximum number of results (1-50)')
  }, async ({ query, limit }) => {
    const results = await spotifyService.searchTracks(query, limit)
    return formatResponse('Track search completed', results)
  })

  server.tool('searchArtists', 'Search for artists on Spotify', {
    query: z.string().describe('Search query for artists'),
    limit: z.number().optional().default(20).describe('Maximum number of results (1-50)')
  }, async ({ query, limit }) => {
    const results = await spotifyService.searchArtists(query, limit)
    return formatResponse('Artist search completed', results)
  })

  server.tool('searchAlbums', 'Search for albums on Spotify', {
    query: z.string().describe('Search query for albums'),
    limit: z.number().optional().default(20).describe('Maximum number of results (1-50)')
  }, async ({ query, limit }) => {
    const results = await spotifyService.searchAlbums(query, limit)
    return formatResponse('Album search completed', results)
  })

  server.tool('getCurrentPlayback', "Get information about the user's current playback", {}, async () => {
    const playback = await spotifyService.getCurrentPlayback()
    return formatResponse('Current playback retrieved', playback)
  })

  server.tool('pausePlayback', "Pause the user's playback", {}, async () => {
    await spotifyService.pausePlayback()
    retu rn formatResponse('Playback paused', {})
  })

  server.tool('resumePlayback', "Resume the user's playback", {}, async () => {
    await spotifyService.resumePlayback()
    return formatResponse('Playback resumed', {})
  })

  server.tool('getUserPlaylists', "Get the current user's playlists", {
    limit: z.number().optional().default(20),
    offset: z.number().optional().default(0)
  }, async ({ limit, offset }) => {
    const playlists = await spotifyService.getUserPlaylists(limit, offset)
    return formatResponse('User playlists retrieved', playlists)
  })

  server.tool('createPlaylist', 'Create a new playlist', {
    name: z.string(),
    description: z.string().optional(),
    public: z.boolean().optional().default(true)
  }, async ({ name, description, public: isPublic }) => {
    const playlist = await spotifyService.createPlaylist(name, description, isPublic)
    return formatResponse('Playlist created', playlist)
  })

  return server
}
