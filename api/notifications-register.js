import { createHash } from 'crypto';
import { getFirebaseAdmin } from './_firebaseAdmin.js';
import { getRealmAllowlist, isRealmAllowed } from './_realmPushConfig.js';

const SUBSCRIPTIONS_COLLECTION = 'realm_push_subscriptions';

function parseBody(req) {
  if (typeof req?.body === 'string') {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return req?.body && typeof req.body === 'object' ? req.body : {};
}

function tokenDocId(realm, token) {
  return createHash('sha256').update(`${realm}:${token}`).digest('hex');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    const body = parseBody(req);
    const allowlist = getRealmAllowlist();
    const realm = String(body?.realm || allowlist[0] || '');
    const token = String(body?.token || '').trim();
    const enabled = body?.enabled !== false;

    if (!realm || !isRealmAllowed(realm)) {
      res.status(400).json({ error: 'Realm is not allowed', realm, allowlist });
      return;
    }

    if (!token || token.length < 20) {
      res.status(400).json({ error: 'Invalid token' });
      return;
    }

    const { db, FieldValue } = getFirebaseAdmin();
    const docId = tokenDocId(realm, token);
    const ref = db.collection(SUBSCRIPTIONS_COLLECTION).doc(docId);

    const payload = {
      realm,
      token,
      enabled,
      source: 'web',
      userAgent: String(req.headers['user-agent'] || ''),
      updatedAt: FieldValue.serverTimestamp(),
    };

    const existing = await ref.get();
    if (!existing.exists) {
      payload.createdAt = FieldValue.serverTimestamp();
    }

    await ref.set(payload, { merge: true });
    res.status(200).json({ ok: true, realm, enabled });
  } catch (error) {
    console.error('Failed to register notification token', error);
    res.status(500).json({ error: 'Failed to register token', details: String(error?.message || error) });
  }
}
