import axios from 'axios';

type GistFile = {
  filename: string;
  raw_url: string;
  type?: string;
  language?: string | null;
};

export async function resolveProposalDescription(descriptionLink: string) {
  try {
    gistApi.cancel();

    const url = new URL(descriptionLink);

    // Fast path: direct raw URL
    if (isRawGistUrl(url)) {
      return await gistApi.fetchUrl(url.toString());
    }

    // Classic gist or embed URL
    if (isGistPageUrl(url)) {
      const content =
        (await gistApi.fetchGistFile(url)) ?? descriptionLink;
      return content;
    }

    // Not a gist URL — return original
    return descriptionLink;
  } catch {
    return descriptionLink;
  }
}

export const gistApi = {
  abortController: null as AbortController | null,

  cancel() {
    this.abortController?.abort();
    this.abortController = null;
  },

  async fetchUrl(rawUrl: string) {
    const controller = new AbortController();
    this.abortController = controller;
    try {
      const res = await axios.get(rawUrl, {
        signal: controller.signal,
        timeout: 15_000,
      });
      return res.data;
    } finally {
      // clear after completion (success or throw)
      if (this.abortController === controller) this.abortController = null;
    }
  },

  async fetchGistFile(gistUrl: URL, token?: string) {
    const controller = new AbortController();
    this.abortController = controller;

    try {
      const { user, id, fileFromQuery, fileFromAnchor } = parseGistUrl(gistUrl);
      if (!user || !id) return undefined;

      // GitHub API for gist metadata
      const apiUrl = `https://api.github.com/gists/${id}`;
      const headers: Record<string, string> = {
        Accept: 'application/vnd.github+json',
      };
      if (token) headers.Authorization = `Bearer ${token}`;

      const apiRes = await axios.get(apiUrl, {
        signal: controller.signal,
        timeout: 15_000,
        headers,
      });

      if (apiRes.status !== 200 || !apiRes.data?.files) return undefined;

      const files: Record<string, GistFile> = apiRes.data.files;

      // Choose file by preference order
      const chosen =
        pickByExactName(files, fileFromQuery) ??
        pickByAnchor(files, fileFromAnchor) ??
        pickByExtensions(files, ['.md', '.markdown', '.txt']) ??
        pickFirst(files);

      if (!chosen?.raw_url) return undefined;

      // Fetch raw content
      const fileRes = await axios.get(chosen.raw_url, {
        signal: controller.signal,
        timeout: 15_000,
      });
      return fileRes.data;
    } catch (err: any) {
      // Optional: inspect err.response?.status for 403/404 if you want different fallbacks
      return undefined;
    } finally {
      if (this.abortController === controller) this.abortController = null;
    }
  },
};

/* ---------- helpers ---------- */

function isGistPageUrl(u: URL) {
  return (
    u.hostname === 'gist.github.com' ||
    u.hostname.endsWith('.gist.github.com') // safety
  );
}

function isRawGistUrl(u: URL) {
  // e.g. https://gist.githubusercontent.com/user/id/raw/<rev>/file.ext
  return u.hostname === 'gist.githubusercontent.com';
}

function parseGistUrl(u: URL) {
  // Path looks like: /{user}/{id}
  // Optional file selection:
  //   ?file=somefile.ext
  //   #file-somefile-ext (gist anchor replaces dots with dashes)
  const segs = u.pathname.split('/').filter(Boolean);
  const user = segs[0] || '';
  const id = segs[1] || '';

  const fileFromQuery = u.searchParams.get('file') || undefined;

  let fileFromAnchor: string | undefined;
  if (u.hash.startsWith('#file-')) {
    // convert #file-some-name-ext back to some-name.ext
    const nameDash = u.hash.replace(/^#file-/, '');
    // anchor uses dashes instead of dots; best-effort reverse:
    // try to restore last dash to a dot (common gist behavior)
    const parts = nameDash.split('-');
    if (parts.length > 1) {
      const last = parts.pop()!;
      fileFromAnchor = parts.join('-') + '.' + last;
    } else {
      fileFromAnchor = nameDash;
    }
  }

  return { user, id, fileFromQuery, fileFromAnchor };
}

function pickByExactName(
  files: Record<string, GistFile>,
  name?: string
): GistFile | undefined {
  if (!name) return undefined;
  return files[name] || undefined;
}

function pickByAnchor(
  files: Record<string, GistFile>,
  anchorName?: string
): GistFile | undefined {
  if (!anchorName) return undefined;
  // Try exact first
  if (files[anchorName]) return files[anchorName];
  // Fallback: case-insensitive match
  const lower = anchorName.toLowerCase();
  return Object.values(files).find(f => f.filename.toLowerCase() === lower);
}

function pickByExtensions(
  files: Record<string, GistFile>,
  exts: string[]
): GistFile | undefined {
  const values = Object.values(files);
  for (const ext of exts) {
    const hit = values.find(f => f.filename.toLowerCase().endsWith(ext));
    if (hit) return hit;
  }
  return undefined;
}

function pickFirst(files: Record<string, GistFile>): GistFile | undefined {
  const names = Object.keys(files);
  return names.length ? files[names[0]] : undefined;
}