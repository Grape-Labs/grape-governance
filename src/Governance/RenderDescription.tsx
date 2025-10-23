import React, { useMemo } from 'react';
import { Typography, Tooltip } from '@mui/material';
import WarningIcon from '@mui/icons-material/Warning';
import DOMPurify from 'isomorphic-dompurify';
import { decode } from 'html-entities'; // yarn add html-entities

// --- Validation helpers ------------------------------------------------------

// 1) Add a tiny decoder (no dependency)
const decodeEntities = (s: string) => {
  if (!s) return s;
  if (typeof window === 'undefined') return s; // SSR: skip (your source should be unescaped on server)
  const doc = new DOMParser().parseFromString(s, 'text/html');
  return doc.documentElement.textContent || s;
};

// 2) Make HTML detection work on *decoded* string
const isProbablyHTML = (s: string) => /<\/?[a-z][\s\S]*>/i.test(s);

// 3) Strip tags for validation
const stripTags = (html: string) =>
  html.replace(/<\/?[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();

// 4) RELAX your validator (length >= 5 instead of 10) and validate the *decoded* text
export const isValidDescription = (desc?: string): boolean => {
  if (!desc) return false;

  const decoded = decodeEntities(desc);
  const looksHtml = isProbablyHTML(decoded);
  const text = looksHtml ? stripTags(decoded) : decoded;

  const trimmed = text.trim();
  // ↓ reduce from 10 → 5 (your "test test" is 9 chars total including space, but keep this robust)
  if (trimmed.length < 5 || !/[a-zA-Z0-9]/.test(trimmed)) return false;

  const wordCount = trimmed.split(/\s+/).filter(Boolean).length;
  return looksHtml ? wordCount >= 1 : wordCount >= 2;
};

export const isValidTitle = (title?: string): boolean => {
  return (
    !!title &&
    title.trim().length >= 2 &&
    /[a-zA-Z0-9]/.test(title) &&
    title.trim().toLowerCase() !== 'transfer tokens'
  );
};



// --- Sanitizer ---------------------------------------------------------------

const sanitizeHtml = (html: string) => {
  if (typeof window !== 'undefined' && !(window as any).__dp_link_hook__) {
    DOMPurify.addHook('afterSanitizeAttributes', (node) => {
      if ('target' in node) {
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
      }
      if (node.tagName === 'A') {
        const href = node.getAttribute('href') || '';
        if (!/^(https?:|mailto:|tel:|#)/i.test(href)) node.removeAttribute('href');
      }
    });
    (window as any).__dp_link_hook__ = true;
  }

  return DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    ALLOWED_TAGS: [
      'b','strong','i','em','u','s','br','p','div','span','ul','ol','li',
      'blockquote','code','pre','a','img','h1','h2','h3','h4','h5','h6'
    ],
    ALLOWED_ATTR: ['href','title','target','rel','src','alt'],
    ALLOW_DATA_ATTR: false,
    FORBID_TAGS: ['style','svg','math'],
    FORBID_ATTR: ['style','onerror','onload','onclick']
  });
};

// --- Component ---------------------------------------------------------------

type RenderDescriptionProps = {
  title?: string;
  description?: string; // may contain HTML or escaped HTML
  fallback: string;
};

export const RenderDescription: React.FC<RenderDescriptionProps> = ({
  title,
  description,
  fallback,
}) => {
  // Decode &lt;p&gt;...&lt;/p&gt; → <p>...</p>
  const decoded = useMemo(() => decode(description ?? ''), [description]);

  const wantsHtml = !!decoded && isProbablyHTML(decoded);
  const hasValidDescription = isValidDescription(decoded);
  const hasValidTitle = isValidTitle(title);

  const safeHtml = useMemo(
    () => (wantsHtml && hasValidDescription ? sanitizeHtml(decoded) : ''),
    [wantsHtml, hasValidDescription, decoded]
  );

  return (
    <Typography color="gray" component="div">
      {hasValidDescription ? (
        wantsHtml ? (
          <div dangerouslySetInnerHTML={{ __html: safeHtml }} />
        ) : (
          decoded
        )
      ) : hasValidTitle ? (
        title
      ) : (
        <Tooltip title="Invalid or missing data">
          <h5 style={{ color: 'red' }}>
            <WarningIcon sx={{ fontSize: 16, color: 'red' }} /> <strong>WARNING!</strong> This proposal has
            missing data; carefully review the instructions before voting
            <small>
              <br />
              Title: "{title}" Description: "{decoded}"
              <br />
              Proposal: {fallback}
            </small>
          </h5>
        </Tooltip>
      )}
    </Typography>
  );
};