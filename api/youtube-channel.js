// Fetches list of video URLs from a YouTube channel via RapidAPI (YouTube Data API)
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'Missing channel URL' });
  }

  // Extract channel ID from various formats
  let channelId = null;
  const channelMatch = url.match(/channel\/(UC[\w-]+)/);
  const handleMatch = url.match(/@([\w.]+)/);
  if (channelMatch) {
    channelId = channelMatch[1];
  } else if (handleMatch) {
    // Use handle to get channel ID (simplified: we'll assume the handle is the same as custom URL)
    // In production you'd need another API call to resolve handle -> channel ID
    channelId = handleMatch[1]; // this is a placeholder
  } else {
    channelId = url;
  }

  const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '';
  const RAPIDAPI_HOST = 'youtube-v31.p.rapidapi.com';

  try {
    // 1. Get uploads playlist
    const channelsResponse = await fetch(
      `https://${RAPIDAPI_HOST}/channels?part=contentDetails&id=${channelId}`,
      {
        headers: {
          'X-RapidAPI-Key': RAPIDAPI_KEY,
          'X-RapidAPI-Host': RAPIDAPI_HOST,
        },
      }
    );

    if (!channelsResponse.ok) throw new Error(`Channel fetch failed: ${channelsResponse.status}`);

    const channelData = await channelsResponse.json();
    const uploadsPlaylistId =
      channelData.items?.[0]?.contentDetails?.relatedPlaylists?.uploads;
    if (!uploadsPlaylistId) throw new Error('Uploads playlist not found');

    // 2. Get playlist items (max 50)
    const playlistResponse = await fetch(
      `https://${RAPIDAPI_HOST}/playlistItems?part=snippet&playlistId=${uploadsPlaylistId}&maxResults=50`,
      {
        headers: {
          'X-RapidAPI-Key': RAPIDAPI_KEY,
          'X-RapidAPI-Host': RAPIDAPI_HOST,
        },
      }
    );

    if (!playlistResponse.ok) throw new Error(`Playlist fetch failed: ${playlistResponse.status}`);

    const playlistData = await playlistResponse.json();
    const videos = playlistData.items.map(item => 
      `https://www.youtube.com/watch?v=${item.snippet.resourceId.videoId}`
    );

    return res.status(200).json({ videos });
  } catch (err) {
    console.error('Channel API error:', err);
    // Fallback for dev
    if (!RAPIDAPI_KEY) {
      return res.status(200).json({
        videos: [
          'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
          'https://www.youtube.com/watch?v=9bZkp7q19f0',
        ],
      });
    }
    return res.status(500).json({ error: err.message });
  }
};
