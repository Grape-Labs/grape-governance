import React from 'react';
import { ImageResponse } from '@vercel/og';
import { shortKey } from './proposal.js';

const h = React.createElement;
const truncate = (text, length) => text.length > length ? `${text.slice(0, length - 1)}…` : text;

export function renderProposalImage(preview) {
  return new ImageResponse(h('div', { style: {
    display: 'flex', flexDirection: 'column', width: '100%', height: '100%',
    padding: '58px 64px', background: 'linear-gradient(125deg, #10051c, #35283e)',
    color: 'white', fontFamily: 'sans-serif',
  } },
  h('div', { style: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' } },
    h('div', { style: { fontSize: 28, color: '#d8b4fe' } }, 'Governance by Grape'),
    h('div', { style: { fontSize: 24, padding: '10px 22px', borderRadius: 24, background: '#593477' } }, preview.state)),
  h('div', { style: { fontSize: 26, color: '#d0bfdc', marginTop: 42 } }, truncate(preview.dao, 64)),
  h('div', { style: { display: 'flex', fontSize: preview.title.length > 100 ? 44 : 54,
    lineHeight: 1.18, fontWeight: 700, marginTop: 18, overflow: 'hidden', maxHeight: 260,
    wordBreak: 'break-word' } }, truncate(preview.title, 190)),
  h('div', { style: { display: 'flex', marginTop: 'auto', paddingTop: 22,
    borderTop: '1px solid #685473', justifyContent: 'space-between', fontSize: 22, color: '#d0bfdc' } },
    h('div', null, 'governance.so'), h('div', null, `Proposal ${shortKey(preview.proposal)}`))),
  { width: 1200, height: 630 });
}
