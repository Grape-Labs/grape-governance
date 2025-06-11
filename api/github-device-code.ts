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

  const data = await response.text(); // GitHub sometimes responds as text
  res.setHeader('Content-Type', 'application/json');
  res.status(200).send(data);
}