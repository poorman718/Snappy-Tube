// Vercel serverless function – proxies YouTube video info requests to RapidAPI
module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: 'Missing video URL' });
  }

  const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || '';
  const RAPIDAPI_HOST = 'youtube-downloader1.p.rapidapi.com'; // Replace with your preferred endpoint

  try {
    const apiUrl = `https://${RAPIDAPI_HOST}/?url=${encodeURIComponent(url)}&format=json`;
    const response = await fetch(apiUrl, {
      headers: {
        'X-RapidAPI-Key': RAPIDAPI_KEY,
        'X-RapidAPI-Host': RAPIDAPI_HOST,
      },
    });

    if (!response.ok) {
      const text = await response.text();
      throw new Error(`RapidAPI error: ${response.status}`);
    }

    const data = await response.json();

    // Normalize the response to our expected format
    const result = {
      title: data.title || 'Unknown title',
      channel: data.channel || data.uploader || '',
      thumbnail: data.thumbnail || '',
      url: url,
      downloads: {
        hd: data.links?.find(l => l.quality?.includes('1080') || l.quality?.includes('720'))?.url || data.url,
        mp3: data.links?.find(l => l.format === 'mp3')?.url || data.audio || null,
      },
    };

    return res.status(200).json(result);
  } catch (err) {
    console.error('Download API error:', err);
    // Fallback mock for development (only if key not set)
    if (!RAPIDAPI_KEY) {
      return res.status(200).json({
        title: 'Sample Video (No API Key)',
        channel: 'YourTube Dev',
        thumbnail: 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg',
        url: url,
        downloads: {
          hd: 'https://www.w3schools.com/html/mov_bbb.mp4', // sample video
          mp3: null,
        },
      });
    }
    return res.status(500).json({ error: err.message });
  }
};
