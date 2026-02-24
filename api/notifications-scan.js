import { createHash } from 'crypto';
import { getFirebaseAdmin } from './_firebaseAdmin.js';
import { fetchRealmProposals, isVotingState } from './_realmProposalIndex.js';
import {
  getAppBaseUrl,
  getProgramIdForRealm,
  getRealmAllowlist,
  isRealmAllowed,
} from './_realmPushConfig.js';

const SUBSCRIPTIONS_COLLECTION = 'realm_push_subscriptions';
const PROPOSAL_STATE_COLLECTION = 'realm_push_proposal_state';
const META_COLLECTION = 'realm_push_meta';
const MAX_EVENTS_PER_SCAN = 15;
const MAX_BATCH_WRITES = 450;

function tokenDocId(realm, token) {
  return createHash('sha256').update(`${realm}:${token}`).digest('hex');
}

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

function parseBoolean(value) {
  if (typeof value === 'boolean') return value;
  const normalized = String(value ?? '').trim().toLowerCase();
  return normalized === '1' || normalized === 'true' || normalized === 'yes';
}

function splitCsv(value) {
  return String(value || '')
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

function getAuthToken(req) {
  const header = String(req?.headers?.authorization || '');
  if (!header.toLowerCase().startsWith('bearer ')) return null;
  return header.slice(7).trim();
}

function isAuthorized(req) {
  const required = process.env.REALM_PUSH_CRON_SECRET || process.env.CRON_SECRET;
  if (!required) return true;

  const bearer = getAuthToken(req);
  const xSecret = String(req?.headers?.['x-cron-secret'] || '');
  return bearer === required || xSecret === required;
}

function proposalStateDocId(realm, proposalPk) {
  return `${realm}:${proposalPk}`;
}

function shortenPk(pk) {
  if (!pk || pk.length < 10) return pk || '';
  return `${pk.slice(0, 4)}...${pk.slice(-4)}`;
}

function sanitizeText(text, fallback) {
  const trimmed = String(text || '').trim();
  return trimmed.length > 0 ? trimmed : fallback;
}

function createEvent(proposal, previousState) {
  const isVotingNow = isVotingState(proposal?.state);
  if (!previousState) {
    return {
      type: 'created',
      proposal,
      isVotingNow,
    };
  }

  const wasVoting = isVotingState(previousState?.state);
  if (!wasVoting && isVotingNow) {
    return {
      type: 'voting',
      proposal,
      isVotingNow,
    };
  }

  return null;
}

function buildNotificationMessage(event, realm, appBaseUrl) {
  const proposal = event.proposal;
  const proposalName = sanitizeText(proposal?.name, shortenPk(proposal?.pubkey));
  const link = `${appBaseUrl}/proposal/${realm}/${proposal.pubkey}`;

  if (event.type === 'voting') {
    return {
      title: 'Proposal Entered Voting',
      body: `${proposalName} is now in voting.`,
      link,
    };
  }

  if (event.isVotingNow) {
    return {
      title: 'New Proposal (Voting Live)',
      body: `${proposalName} was created and is already in voting.`,
      link,
    };
  }

  return {
    title: 'New Proposal Created',
    body: `${proposalName} was created.`,
    link,
  };
}

async function loadSubscriberTokens(db, realm) {
  const snapshot = await db
    .collection(SUBSCRIPTIONS_COLLECTION)
    .where('realm', '==', realm)
    .where('enabled', '==', true)
    .get();

  const tokens = [];
  snapshot.forEach((doc) => {
    const token = String(doc.data()?.token || '').trim();
    if (token) tokens.push(token);
  });
  return tokens;
}

async function loadPreviousProposalStates(db, realm) {
  const snapshot = await db.collection(PROPOSAL_STATE_COLLECTION).where('realm', '==', realm).get();
  const map = new Map();

  snapshot.forEach((doc) => {
    const data = doc.data();
    const proposalPk = String(data?.proposalPk || '');
    if (!proposalPk) return;
    map.set(proposalPk, {
      state: data?.state,
      draftAt: Number(data?.draftAt || 0),
      votingAt: Number(data?.votingAt || 0),
    });
  });

  return map;
}

async function writeProposalStates(db, FieldValue, realm, proposals) {
  for (let i = 0; i < proposals.length; i += MAX_BATCH_WRITES) {
    const batch = db.batch();
    const chunk = proposals.slice(i, i + MAX_BATCH_WRITES);

    for (const proposal of chunk) {
      const ref = db.collection(PROPOSAL_STATE_COLLECTION).doc(proposalStateDocId(realm, proposal.pubkey));
      batch.set(
        ref,
        {
          realm,
          proposalPk: proposal.pubkey,
          governancePk: proposal.governance,
          name: proposal.name || '',
          state: proposal.state,
          draftAt: Number(proposal.draftAt || 0),
          votingAt: Number(proposal.votingAt || 0),
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    await batch.commit();
  }
}

async function disableTokens(db, FieldValue, realm, tokens) {
  if (!Array.isArray(tokens) || tokens.length === 0) return;

  for (let i = 0; i < tokens.length; i += MAX_BATCH_WRITES) {
    const batch = db.batch();
    const chunk = tokens.slice(i, i + MAX_BATCH_WRITES);

    for (const token of chunk) {
      const ref = db.collection(SUBSCRIPTIONS_COLLECTION).doc(tokenDocId(realm, token));
      batch.set(
        ref,
        {
          enabled: false,
          disabledReason: 'invalid_fcm_token',
          updatedAt: FieldValue.serverTimestamp(),
        },
        { merge: true }
      );
    }

    await batch.commit();
  }
}

function chunkArray(values, size) {
  const chunks = [];
  for (let i = 0; i < values.length; i += size) {
    chunks.push(values.slice(i, i + size));
  }
  return chunks;
}

function collectInvalidToken(code) {
  return (
    code === 'messaging/registration-token-not-registered' ||
    code === 'messaging/invalid-registration-token'
  );
}

async function sendNotificationToTokens(messaging, tokens, message) {
  let successCount = 0;
  const invalidTokens = new Set();

  for (const tokenChunk of chunkArray(tokens, 500)) {
    const response = await messaging.sendEachForMulticast({
      tokens: tokenChunk,
      notification: {
        title: message.title,
        body: message.body,
      },
      data: {
        realm: message.realm,
        proposalPk: message.proposalPk,
        eventType: message.eventType,
        link: message.link,
      },
      webpush: {
        fcmOptions: {
          link: message.link,
        },
        notification: {
          icon: `${message.appBaseUrl}/icons/icon-192x192.png`,
          badge: `${message.appBaseUrl}/icons/icon-192x192.png`,
        },
      },
    });

    successCount += Number(response?.successCount || 0);
    response.responses.forEach((item, idx) => {
      if (item.success) return;
      const code = String(item?.error?.code || '');
      if (collectInvalidToken(code)) {
        invalidTokens.add(tokenChunk[idx]);
      }
    });
  }

  return {
    successCount,
    invalidTokens: Array.from(invalidTokens),
  };
}

async function scanSingleRealm({
  db,
  FieldValue,
  messaging,
  realm,
  programId,
  appBaseUrl,
  dryRun,
}) {
  const metaRef = db.collection(META_COLLECTION).doc(realm);
  const [metaDoc, previousStateMap, subscriberTokens, proposals] = await Promise.all([
    metaRef.get(),
    loadPreviousProposalStates(db, realm),
    loadSubscriberTokens(db, realm),
    fetchRealmProposals(realm, programId),
  ]);

  const initialized = !!metaDoc.data()?.initializedAt;
  const events = [];

  for (const proposal of proposals) {
    const previous = previousStateMap.get(proposal.pubkey);
    const event = createEvent(proposal, previous);
    if (event) events.push(event);
  }

  events.sort((a, b) => Number(b?.proposal?.draftAt || 0) - Number(a?.proposal?.draftAt || 0));
  const cappedEvents = events.slice(0, MAX_EVENTS_PER_SCAN);

  if (!dryRun) {
    await writeProposalStates(db, FieldValue, realm, proposals);
    await metaRef.set(
      {
        initializedAt: initialized ? metaDoc.data()?.initializedAt || FieldValue.serverTimestamp() : FieldValue.serverTimestamp(),
        lastRunAt: FieldValue.serverTimestamp(),
        lastSeenProposalCount: proposals.length,
      },
      { merge: true }
    );
  }

  let notificationsSent = 0;
  let disabledTokens = 0;

  if (initialized && cappedEvents.length > 0 && subscriberTokens.length > 0 && !dryRun) {
    const toDisable = new Set();
    for (const event of cappedEvents) {
      const built = buildNotificationMessage(event, realm, appBaseUrl);
      const delivery = await sendNotificationToTokens(messaging, subscriberTokens, {
        title: built.title,
        body: built.body,
        link: built.link,
        realm,
        proposalPk: event?.proposal?.pubkey || '',
        eventType: event.type,
        appBaseUrl,
      });
      notificationsSent += delivery.successCount;
      delivery.invalidTokens.forEach((token) => toDisable.add(token));
    }

    if (toDisable.size > 0) {
      const invalidTokens = Array.from(toDisable);
      await disableTokens(db, FieldValue, realm, invalidTokens);
      disabledTokens = invalidTokens.length;
    }
  }

  return {
    realm,
    programId,
    initialized,
    dryRun,
    proposalsScanned: proposals.length,
    subscribers: subscriberTokens.length,
    eventsDetected: cappedEvents.length,
    notificationsSent,
    disabledTokens,
    events: cappedEvents.map((event) => ({
      type: event.type,
      proposalPk: event?.proposal?.pubkey,
      proposalName: event?.proposal?.name || shortenPk(event?.proposal?.pubkey),
      state: event?.proposal?.state,
      draftAt: event?.proposal?.draftAt || 0,
      votingAt: event?.proposal?.votingAt || 0,
    })),
  };
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  if (!isAuthorized(req)) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  try {
    const body = parseBody(req);
    const dryRun = parseBoolean(req?.query?.dryRun ?? body?.dryRun);
    const requestedRealmCsv = req?.query?.realm ?? body?.realm;
    const requestedRealms = splitCsv(requestedRealmCsv);
    const allowlist = getRealmAllowlist();

    const realmsToScan = (requestedRealms.length > 0 ? requestedRealms : allowlist).filter((realm) =>
      isRealmAllowed(realm)
    );

    if (realmsToScan.length === 0) {
      res.status(400).json({ error: 'No valid realm to scan', allowlist });
      return;
    }

    const { db, FieldValue, messaging } = getFirebaseAdmin();
    const appBaseUrl = getAppBaseUrl(req);

    const results = [];
    for (const realm of realmsToScan) {
      const programId = getProgramIdForRealm(realm);
      const result = await scanSingleRealm({
        db,
        FieldValue,
        messaging,
        realm,
        programId,
        appBaseUrl,
        dryRun,
      });
      results.push(result);
    }

    res.status(200).json({
      ok: true,
      dryRun,
      scannedAt: new Date().toISOString(),
      realms: realmsToScan,
      results,
    });
  } catch (error) {
    console.error('Failed to scan and notify', error);
    res.status(500).json({ error: 'Failed to scan notifications', details: String(error?.message || error) });
  }
}
