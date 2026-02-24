import { createHash } from 'crypto';
import { getFirebaseAdmin } from './_firebaseAdmin.js';
import { getAppBaseUrl, getRealmAllowlist, isRealmAllowed } from './_realmPushConfig.js';

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

function getAuthToken(req) {
  const header = String(req?.headers?.authorization || '');
  if (!header.toLowerCase().startsWith('bearer ')) return null;
  return header.slice(7).trim();
}

function isAuthorized(req) {
  const required =
    process.env.REALM_PUSH_TEST_SECRET ||
    process.env.REALM_PUSH_CRON_SECRET ||
    process.env.CRON_SECRET;
  if (!required) return true;

  const bearer = getAuthToken(req);
  const xSecret = String(req?.headers?.['x-push-test-secret'] || '');
  return bearer === required || xSecret === required;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!isAuthorized(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const body = parseBody(req);
    const allowlist = getRealmAllowlist();
    const realm = String(body?.realm || allowlist[0] || '');
    const token = String(body?.token || '').trim();
    const title = String(body?.title || 'Push Test');
    const messageBody = String(
      body?.body || 'If you can read this, push notifications are working.'
    );

    if (!realm || !isRealmAllowed(realm)) {
      res.status(400).json({ error: 'Realm is not allowed', realm, allowlist });
      return;
    }

    if (!token || token.length < 20) {
      res.status(400).json({ error: 'Invalid token' });
      return;
    }

    const { db, messaging } = getFirebaseAdmin();
    const subscriptionRef = db.collection(SUBSCRIPTIONS_COLLECTION).doc(tokenDocId(realm, token));
    const subscriptionDoc = await subscriptionRef.get();
    if (!subscriptionDoc.exists || !subscriptionDoc.data()?.enabled) {
      res.status(400).json({
        error: 'Token is not registered/enabled for this realm',
        realm,
      });
      return;
    }

    const appBaseUrl = getAppBaseUrl(req);
    const link = `${appBaseUrl}/dao/${realm}`;

    const response = await messaging.send({
      token,
      notification: {
        title,
        body: messageBody,
      },
      data: {
        realm,
        eventType: 'test',
        link,
      },
      webpush: {
        fcmOptions: {
          link,
        },
        notification: {
          icon: `${appBaseUrl}/icons/icon-192x192.png`,
          badge: `${appBaseUrl}/icons/icon-192x192.png`,
        },
      },
    });

    res.status(200).json({
      ok: true,
      realm,
      messageId: response,
    });
  } catch (error) {
    console.error('Failed to send test notification', error);
    res.status(500).json({
      error: 'Failed to send test notification',
      details: String(error?.message || error),
    });
  }
}
