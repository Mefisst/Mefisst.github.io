const { Readable } = require('stream');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

  let target = req.query.url || req.query.u;

  if (Array.isArray(target)) target = target[0];

  if (!target) {
    res.statusCode = 400;
    res.end('Missing url');
    return;
  }

  target = String(target).trim();

  try {
    target = decodeURIComponent(target);
  } catch (e) {}

  target = target.replace(/^\/+/, '');

  const candidates = [];

  if (/^https?:\/\//i.test(target)) {
    candidates.push(target);

    if (target.startsWith('https://')) {
      candidates.push('http://' + target.replace(/^https:\/\//i, ''));
    }
  } else {
    candidates.push('http://' + target);
    candidates.push('https://' + target);
  }

  const baseHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
    'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
  };

  let finalResponse = null;
  let finalUrl = '';
  let lastError = '';

  for (const url of candidates) {
    let parsed;

    try {
      parsed = new URL(url);
    } catch (e) {
      lastError = 'Bad url: ' + url;
      continue;
    }

    const host = parsed.hostname.toLowerCase();

    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)
    ) {
      lastError = 'Forbidden host: ' + host;
      continue;
    }

    const headers = {
      ...baseHeaders,
      'Referer': parsed.origin + '/'
    };

    try {
      console.log('TRY:', url);

      const response = await fetch(url, {
        method: 'GET',
        headers,
        redirect: 'follow'
      });

      console.log('STATUS:', response.status, url);

      if (response.ok) {
        finalResponse = response;
        finalUrl = url;
        break;
      }

      lastError = 'Status ' + response.status + ' for ' + url;
    } catch (e) {
      lastError = 'Fetch failed for ' + url + ': ' + (e && e.message ? e.message : String(e));
      console.log('FETCH ERROR:', lastError);
    }
  }

  if (!finalResponse) {
    res.statusCode = 502;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Proxy failed\n' + lastError + '\nOriginal: ' + target);
    return;
  }

  try {
    const contentType = finalResponse.headers.get('content-type') || 'image/jpeg';

    res.statusCode = 200;
    res.setHeader('Content-Type', contentType);
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('X-Proxy-By', 'vercel-img-proxy');
    res.setHeader('X-Final-Url', finalUrl);

    if (finalResponse.body) {
      const nodeStream = Readable.fromWeb(finalResponse.body);
      nodeStream.on('error', function (err) {
        console.log('STREAM ERROR:', err && err.message ? err.message : err);
        try {
          res.destroy(err);
        } catch (e) {}
      });
      nodeStream.pipe(res);
    } else {
      const arrayBuffer = await finalResponse.arrayBuffer();
      res.end(Buffer.from(arrayBuffer));
    }
  } catch (e) {
    console.log('RESPONSE ERROR:', e && e.stack ? e.stack : e);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.end('Response error: ' + (e && e.message ? e.message : String(e)));
  }
};
