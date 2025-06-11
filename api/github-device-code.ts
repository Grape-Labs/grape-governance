export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method Not Allowed' });
    return;
  }

  //res.status(200).json({ success: true, message: 'API is working' });

  const response = await fetch('https://github.com/login/device/code', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      client_id: process.env.APP_GITHUB_CLIENT_ID,
      scope: 'gist'
    })
  });

  const raw = await response.text();
  const params = new URLSearchParams(raw);
  const data = Object.fromEntries(params.entries());

  res.status(200).json(data);
}