import {parseProposalRequest} from '../src/server/social/proposal.js';

// Compatibility URL; Next now renders proposal metadata with the page itself.
export default function handler(req, res) {
  let context;
  try {context = parseProposalRequest(req);}
  catch {return res.status(400).send('Invalid proposal address');}
  return res.redirect(307, `/proposal/${context.realm}/${context.proposal}`);
}
