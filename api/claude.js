const https = require('https');

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: { message: 'Method not allowed' } });

  try {
    const body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
    const postData = JSON.stringify(body);

    const data = await new Promise((resolve, reject) => {
      const options = {
        hostname: 'api.anthropic.com',
        path: '/v1/messages',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(postData),
          'x-api-key': process.env.ANTHROPIC_API_KEY,
          'anthropic-version': '2023-06-01'
        }
      };
      const reqHttp = https.request(options, (r) => {
        let raw = '';
        r.on('data', chunk => raw += chunk);
        r.on('end', () => {
          try { resolve({ status: r.statusCode, body: JSON.parse(raw) }); }
          catch (e) { reject(new Error('Invalid JSON from Anthropic: ' + raw.slice(0, 100))); }
        });
      });
      reqHttp.on('error', reject);
      reqHttp.write(postData);
      reqHttp.end();
    });

    return res.status(data.status).json(data.body);
  } catch (error) {
    console.error('Claude proxy error:', error.message);
    return res.status(500).json({ error: { message: error.message } });
  }
};
