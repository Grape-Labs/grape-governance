import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { parseProposalRequest, loadProposalPreview, injectPreview, cacheControl } from '../src/server/social/proposal.js';

export default async function handler(req, res) {
  let context;
  try {
    context = parseProposalRequest(req);
  } catch (_error) {
    return res.status(400).send('Invalid proposal address');
  }
  const [html, preview] = await Promise.all([
    readFile(path.join(process.cwd(), 'dist/index.html'), 'utf8'),
    loadProposalPreview(context),
  ]);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', cacheControl(preview));
  return res.status(200).send(injectPreview(html, preview));
}
