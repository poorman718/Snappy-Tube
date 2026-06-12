/**
 * api/youtube-channel.js
 * ---------------------------------------------------------------------
 * Vercel serverless function (Node runtime).
 * Accepts: POST { url: "<YouTube channel URL>" }
 * Returns: { videos: ["https://www.youtube.com/watch?v=...", ...] }
 *
 * Resolves the channel URL/handle to a channel ID, then fetches up to
 * 50 of its most recent uploads (paginating with the API's continuation
 * token if needed). Proxies through RapidAPI so the key stays server-side.
 * ---------------------------------------------------------------------
 */

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || 'YOUR_RAPIDAPI_KEY_HERE';
const RAPIDAPI_HOST = 'youtube-media-downloader.p.rapidapi.com';
const MAX_VIDEOS = 50;

function rapidHeaders() {
  return {
    'x-rapidapi-key': RAPIDAPI_KEY,
    'x-rapidapi-host': RAPIDAPI_HOST,
  };
}

/**
 * Pulls a channel identifier out of common YouTube channel URL shapes:
 *  - youtube.com/channel/UCxxxxxxxx  -> returns the UC... id directly
 *  - youtube.com/@handle             -> returns { handle: "@handle" }
 *  - youtube.com/c/Name or /user/Name -> returns { handle: "Name" }
 */
function parseChannelInput(url) {
  const trimmed = (url || '').trim();

  const idMatch = trimmed.match(/youtube\.com\/channel\/([\w-]+)/i);
  if (idMatch) return { channelId: idMatch[1] };

  const handleMatch = trimmed.match(/youtube\.com\/@([\w.-]+)/i);
  if (handleMatch) return { handle: `@${handleMatch[1]}` };

  const legacyMatch = trimmed.match(/youtube\.com\/(?:c|user)\/([\w-]+)/i);
  if (legacyMatch) return { handle: legacyMatch[1] };

  // If the user pasted a bare handle or channel ID
  if (/^UC[\w-]{20,}$/.test(trimmed)) return { channelId: trimmed };
  if (trimmed.startsWith('@')) return { handle: trimmed };

  return null;
}

/** Resolve a handle/custom name to a channel ID using the search endpoint. */
async function resolveChannelId(handle) {
  const searchUrl = `https://${RAPIDAPI_HOST}/v2/search/channels?query=${encodeURIComponent(handle)}`;
  const res = await fetch(searchUrl, { headers: rapidHeaders() });
  if (!res.ok) throw new Error(`Channel search failed (${res.status}).`);

  const data = await res.json();
  const items = data.items || data.channels || [];
  if (!items.length) return null;

  // Prefer an exact handle match if the API returns one
  const exact = items.find((c) => (c.handle || '').toLowerCase() === handle.toLowerCase());
  return (exact || items[0]).id || (exact || items[0]).channelId || null;
}

/** Fetch up to MAX_VIDEOS upload URLs for a channel, paginating as needed. */
async function fetchChannelUploads(channelId) {
  const videos = [];
  let nextToken = null;

  do {
    const params = new URLSearchParams({ channelId, type: 'videos' });
    if (nextToken) params.set('nextToken', nextToken);

    const res = await fetch(`https://${RAPIDAPI_HOST}/v2/channel/videos?${params.toString()}`, {
      headers: rapidHeaders(),
    });
    if (!res.ok) throw new Error(`Channel videos request failed (${res.status}).`);

    const data = await res.json();
    const items = data.items || [];

    for (const item of items) {
      const id = item.id || item.videoId;
      if (id) videos.push(`https://www.youtube.com/watch?v=${id}`);
      if (videos.length >= MAX_VIDEOS) break;
    }

    nextToken = videos.length < MAX_VIDEOS ? data.continuation || data.nextToken : null;
  } while (nextToken && videos.length < MAX_VIDEOS);

  return videos.slice(0, MAX_VIDEOS);
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { url } = req.body || {};
    if (!url) {
      return res.status(400).json({ error: 'Missing "url" in request body.' });
    }

    if (!RAPIDAPI_KEY || RAPIDAPI_KEY === 'YOUR_RAPIDAPI_KEY_HERE') {
      return res.status(500).json({ error: 'Server is missing a RapidAPI key. Set RAPIDAPI_KEY in your environment.' });
    }

    const parsed = parseChannelInput(url);
    if (!parsed) {
      return res.status(400).json({ error: 'Could not recognize that channel URL.' });
    }

    let channelId = parsed.channelId;
    if (!channelId && parsed.handle) {
      channelId = await resolveChannelId(parsed.handle);
    }

    if (!channelId) {
      return res.status(404).json({ error: 'Could not find a channel matching that URL.' });
    }

    const videos = await fetchChannelUploads(channelId);

    if (!videos.length) {
      return res.status(404).json({ error: 'No videos were found for this channel.' });
    }

    return res.status(200).json({ videos });
  } catch (err) {
    console.error('youtube-channel error:', err);
    return res.status(500).json({ error: 'Unexpected server error. Please try again.' });
  }
};
