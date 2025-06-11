// /api/github-token.ts
export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const body = req.body;

  const response = await fetch('https://github.com/login/oauth/access_token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    },
    body: JSON.stringify({
      client_id: process.env.REACT_APP_API_GITHUBCLIENTID,
      device_code: body.device_code,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
    })
  });

  const data = await response.json();
  res.status(response.status).json(data);
}