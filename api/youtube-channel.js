/**
 * api/youtube-download.js
 * ---------------------------------------------------------------------
 * Vercel serverless function (Node runtime).
 * Accepts: POST { url: "<YouTube video URL>" }
 * Returns: {
 *   title, channel, thumbnail,
 *   downloadUrl,  // highest quality video+audio mp4
 *   audioUrl      // best audio-only stream (mp3/m4a), if available
 * }
 *
 * Proxies the request to RapidAPI so the API key never reaches the
 * browser. Configure RAPIDAPI_KEY as an environment variable on Vercel.
 * The hardcoded fallback below is only meant for local development —
 * replace it with your own key before deploying.
 * ---------------------------------------------------------------------
 */

const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || 'YOUR_RAPIDAPI_KEY_HERE';
const RAPIDAPI_HOST = 'youtube-media-downloader.p.rapidapi.com';

// Matches youtube.com/watch?v=, youtu.be/, youtube.com/shorts/, youtube.com/embed/
const VIDEO_ID_REGEX = /(?:youtube\.com\/(?:watch\?v=|shorts\/|embed\/)|youtu\.be\/)([a-zA-Z0-9_-]{6,})/i;

function extractVideoId(url) {
  const match = (url || '').match(VIDEO_ID_REGEX);
  return match ? match[1] : null;
}

module.exports = async (req, res) => {
  // Basic CORS / method guard
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

    const videoId = extractVideoId(url);
    if (!videoId) {
      return res.status(400).json({ error: 'Could not extract a video ID from that URL.' });
    }

    if (!RAPIDAPI_KEY || RAPIDAPI_KEY === 'YOUR_RAPIDAPI_KEY_HERE') {
      return res.status(500).json({ error: 'Server is missing a RapidAPI key. Set RAPIDAPI_KEY in your environment.' });
    }

    const apiUrl = `https://${RAPIDAPI_HOST}/v2/video/details?videoId=${encodeURIComponent(videoId)}`;

    const apiRes = await fetch(apiUrl, {
      method: 'GET',
      headers: {
        'x-rapidapi-key': RAPIDAPI_KEY,
        'x-rapidapi-host': RAPIDAPI_HOST,
      },
    });

    if (!apiRes.ok) {
      return res.status(apiRes.status).json({ error: `Upstream API error (${apiRes.status}).` });
    }

    const data = await apiRes.json();

    if (!data || data.status === false) {
      return res.status(404).json({ error: 'Video not found or unavailable.' });
    }

    // ---- Normalize the response ----
    const title = data.title || 'Untitled video';
    const channel = (data.channel && data.channel.name) || data.channelTitle || '';

    const thumbnails = data.thumbnails || [];
    const thumbnail = thumbnails.length ? thumbnails[thumbnails.length - 1].url : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

    // Video formats: pick the highest-resolution stream that includes audio,
    // falling back to the highest-resolution video-only stream.
    const videoFormats = (data.videos && data.videos.items) || [];
    const withAudio = videoFormats.filter((f) => f.hasAudio);
    const sortedVideo = (withAudio.length ? withAudio : videoFormats)
      .slice()
      .sort((a, b) => (b.height || b.quality || 0) - (a.height || a.quality || 0));
    const downloadUrl = sortedVideo.length ? sortedVideo[0].url : null;

    // Audio-only formats: pick the highest bitrate
    const audioFormats = (data.audios && data.audios.items) || [];
    const sortedAudio = audioFormats.slice().sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
    const audioUrl = sortedAudio.length ? sortedAudio[0].url : null;

    if (!downloadUrl) {
      return res.status(502).json({ error: 'No downloadable video stream was returned for this video.' });
    }

    return res.status(200).json({
      title,
      channel,
      thumbnail,
      downloadUrl,
      audioUrl,
    });
  } catch (err) {
    console.error('youtube-download error:', err);
    return res.status(500).json({ error: 'Unexpected server error. Please try again.' });
  }
};
