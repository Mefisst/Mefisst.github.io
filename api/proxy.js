module.exports = async function handler(req, res) {
  try {
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', '*');
      res.end();
      return;
    }

    let target = req.query.url || req.query.u;

    if (!target) {
      res.statusCode = 400;
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.end('Missing url');
      return;
    }

    if (Array.isArray(target)) {
      target = target[0];
    }

    target = String(target).trim();

    try {
      target = decodeURIComponent(target);
    } catch (e) {}

    if (!/^https?:\/\//i.test(target)) {
      target = 'https://' + target.replace(/^\/+/, '');
    }

    let parsed;

    try {
      parsed = new URL(target);
    } catch (e) {
      res.statusCode = 400;
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.end('Bad url');
      return;
    }

    const host = parsed.hostname.toLowerCase();

    if (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host.startsWith('10.') ||
      host.startsWith('192.168.') ||
      /^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(host)
    ) {
      res.statusCode = 403;
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.end('Forbidden host');
      return;
    }

    const headers = {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36',
      'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      'Referer': parsed.origin + '/',
      'Origin': parsed.origin
    };

    let response = await fetch(target, {
      method: 'GET',
      headers: headers,
      redirect: 'follow'
    });

    if (!response.ok && target.startsWith('https://')) {
      const httpTarget = 'http://' + target.replace(/^https:\/\//i, '');

      response = await fetch(httpTarget, {
        method: 'GET',
        headers: headers,
        redirect: 'follow'
      });
    }

    if (!response.ok) {
      res.statusCode = response.status;
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.end('Image fetch error: ' + response.status);
      return;
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg';
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    res.statusCode = 200;
    res.setHeader('Content-Type', contentType);
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', '*');
    res.setHeader('Cache-Control', 'public, max-age=86400');
    res.setHeader('X-Proxy-By', 'vercel-img-proxy');

    res.end(buffer);
  } catch (e) {
    res.statusCode = 500;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.end('Proxy error: ' + e.message);
  }
};
