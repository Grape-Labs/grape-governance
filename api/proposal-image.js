import { parseProposalRequest, loadProposalPreview, cacheControl } from '../src/server/social/proposal.js';
import { renderProposalImage } from '../src/server/social/proposal-image.js';

export default async function handler(req, res) {
  let context;
  try {
    context = parseProposalRequest(req);
  } catch (_error) {
    return res.status(400).send('Invalid proposal address');
  }
  const preview = await loadProposalPreview(context);
  const image = renderProposalImage(preview);
  const buffer = Buffer.from(await image.arrayBuffer());
  res.setHeader('Content-Type', 'image/png');
  res.setHeader('Cache-Control', cacheControl(preview));
  return res.status(200).send(buffer);
}
