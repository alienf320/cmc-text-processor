export default {
  async fetch(request) {
    const url = new URL(request.url);
    const videoId = url.searchParams.get('v');

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: cors() });
    }

    if (!videoId) {
      return json({ error: 'Missing ?v=' }, 400);
    }

    try {
      const ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

      const itResp = await fetch('https://www.youtube.com/youtubei/v1/player?prettyPrint=false', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'User-Agent': ua },
        body: JSON.stringify({
          context: { client: { clientName: 'ANDROID', clientVersion: '20.10.38' } },
          videoId,
        }),
      });
      const itJson = await itResp.json();
      const tracks = itJson?.captions?.playerCaptionsTracklistRenderer?.captionTracks;

      if (!Array.isArray(tracks) || tracks.length === 0) {
        return json({ error: 'No caption tracks available' }, 404);
      }

      const track = tracks.find(t => t.languageCode === 'es') || tracks[0];
      let trackUrl = track.baseUrl;
      if (!trackUrl.includes('&fmt=') && !trackUrl.includes('?fmt=')) {
        trackUrl += '&fmt=srv3';
      }

      const xmlResp = await fetch(trackUrl, { headers: { 'User-Agent': ua } });
      const xml = await xmlResp.text();
      if (!xml || xml.length === 0) {
        return json({ error: 'Empty transcript XML' }, 500);
      }

      const texts = [];
      const pRegex = /<p\s+t="\d+"\s+d="\d+"[^>]*>([\s\S]*?)<\/p>/g;
      let m;
      while ((m = pRegex.exec(xml))) {
        let text = m[1].replace(/<[^>]+>/g, '').replace(/&amp;/g, '&').replace(/&#39;/g, "'").trim();
        if (text) texts.push(text);
      }

      if (texts.length === 0) {
        const classicRegex = /<text start="[^"]*" dur="[^"]*">([^<]*)<\/text>/g;
        while ((m = classicRegex.exec(xml))) {
          const text = m[1].replace(/&amp;/g, '&').replace(/&#39;/g, "'").trim();
          if (text) texts.push(text);
        }
      }

      return json({
        videoId,
        language: track.languageCode,
        trackKind: track.kind || 'manual',
        segmentCount: texts.length,
        fullText: texts.join(' '),
      });
    } catch (err) {
      return json({ error: err.message }, 500);
    }
  },
};

function cors() {
  return { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': '*' };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors() },
  });
}
