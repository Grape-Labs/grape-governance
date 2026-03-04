#!/usr/bin/env node

import { Command } from 'commander';

function getGlobalOptions(command) {
  const merged = {};
  let node = command;
  while (node) {
    Object.assign(merged, node.opts());
    node = node.parent;
  }
  return merged;
}

function cleanObject(input) {
  const output = {};
  for (const [key, value] of Object.entries(input || {})) {
    if (value === undefined || value === null) continue;
    if (typeof value === 'string' && value.trim() === '') continue;
    output[key] = value;
  }
  return output;
}

function toCsv(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    if (value.length === 0) return '';
    if (typeof value[0] !== 'object' || value[0] === null) {
      return value.map((item) => String(item)).join('\n');
    }
    const keys = Object.keys(value[0]);
    const lines = [keys.join(',')];
    for (const row of value) {
      const cells = keys.map((key) => JSON.stringify(row?.[key] ?? ''));
      lines.push(cells.join(','));
    }
    return lines.join('\n');
  }
  if (value && typeof value === 'object') {
    return JSON.stringify(value);
  }
  return String(value ?? '');
}

function printPayload(command, payload) {
  const globals = getGlobalOptions(command);
  const format = String(globals.output || 'table').toLowerCase();

  if (format === 'json') {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }

  if (format === 'csv') {
    const csvSource =
      payload?.data?.participants ??
      payload?.data ??
      payload?.results ??
      payload;
    console.log(toCsv(csvSource));
    return;
  }

  if (Array.isArray(payload?.data)) {
    console.table(payload.data);
    if (payload?.page) {
      console.log(`has_more=${Boolean(payload.page.has_more)} next_cursor=${payload.page.next_cursor || ''}`);
    }
    return;
  }

  if (Array.isArray(payload?.data?.participants)) {
    console.table(payload.data.participants.map((participant) => ({ participant })));
    return;
  }

  if (Array.isArray(payload?.results)) {
    console.table(payload.results);
    return;
  }

  console.log(JSON.stringify(payload, null, 2));
}

async function apiRequest(command, method, path, { query = {}, body, expectText = false } = {}) {
  const globals = getGlobalOptions(command);
  const baseUrl = String(globals.baseUrl || 'https://governance.so/api/v1').replace(/\/+$/, '');
  const fullUrl = new URL(`${baseUrl}${path}`);
  for (const [key, value] of Object.entries(cleanObject(query))) {
    if (Array.isArray(value)) {
      for (const item of value) fullUrl.searchParams.append(key, String(item));
    } else {
      fullUrl.searchParams.set(key, String(value));
    }
  }

  const headers = {
    Accept: expectText ? 'text/plain' : 'application/json',
  };
  if (globals.apiKey) headers.Authorization = `Bearer ${globals.apiKey}`;
  if (globals.cluster) headers['X-Cluster'] = globals.cluster;

  const init = {
    method,
    headers,
  };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
    init.body = JSON.stringify(body);
  }

  if (globals.verbose) {
    console.error(`[govso] ${method} ${fullUrl.toString()}`);
  }

  const response = await fetch(fullUrl, init);
  if (expectText) {
    const text = await response.text();
    if (!response.ok) {
      throw new Error(text || `Request failed with status ${response.status}`);
    }
    return text;
  }

  const text = await response.text();
  let payload;
  try {
    payload = text ? JSON.parse(text) : {};
  } catch {
    payload = { data: text };
  }

  if (!response.ok) {
    const message =
      payload?.error?.message ||
      payload?.message ||
      `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  return payload;
}

async function run(command, fn) {
  try {
    await fn();
  } catch (error) {
    console.error(`Error: ${error?.message || error}`);
    process.exitCode = 1;
  }
}

const program = new Command();
program
  .name('govso')
  .description('Governance.so API v1 CLI')
  .option('--base-url <url>', 'API base URL', process.env.GOVSO_BASE_URL || 'https://governance.so/api/v1')
  .option('--api-key <key>', 'API key token', process.env.GOVSO_API_KEY || '')
  .option('--cluster <cluster>', 'Cluster override header')
  .option('--output <format>', 'Output format: table|json|csv', 'table')
  .option('--verbose', 'Verbose request logging', false);

program
  .command('health')
  .description('Check API health')
  .action(async (_, cmd) => {
    await run(cmd, async () => {
      const payload = await apiRequest(cmd, 'GET', '/health');
      printPayload(cmd, payload);
    });
  });

program
  .command('meta')
  .description('Get API metadata')
  .action(async (_, cmd) => {
    await run(cmd, async () => {
      const payload = await apiRequest(cmd, 'GET', '/meta');
      printPayload(cmd, payload);
    });
  });

const realms = program.command('realms').description('Realm commands');

realms
  .command('list')
  .option('--search <value>')
  .option('--verified', 'Filter verified realms')
  .option('--active-voting', 'Filter active voting realms')
  .option('--min-proposals <number>')
  .option('--program-id <programId>')
  .option('--limit <number>')
  .option('--cursor <cursor>')
  .option('--sort-by <field>')
  .option('--sort-order <order>')
  .action(async (opts, cmd) => {
    await run(cmd, async () => {
      const payload = await apiRequest(cmd, 'GET', '/realms', {
        query: cleanObject({
          search: opts.search,
          verified: opts.verified ? 'true' : undefined,
          active_voting: opts.activeVoting ? 'true' : undefined,
          min_proposals: opts.minProposals,
          program_id: opts.programId,
          limit: opts.limit,
          cursor: opts.cursor,
          sort_by: opts.sortBy,
          sort_order: opts.sortOrder,
        }),
      });
      printPayload(cmd, payload);
    });
  });

realms
  .command('get')
  .argument('<realm_id>')
  .option('--program-id <programId>')
  .action(async (realmId, opts, cmd) => {
    await run(cmd, async () => {
      const payload = await apiRequest(cmd, 'GET', `/realms/${realmId}`, {
        query: cleanObject({ program_id: opts.programId }),
      });
      printPayload(cmd, payload);
    });
  });

realms
  .command('stats')
  .argument('<realm_id>')
  .option('--program-id <programId>')
  .action(async (realmId, opts, cmd) => {
    await run(cmd, async () => {
      const payload = await apiRequest(cmd, 'GET', `/realms/${realmId}/stats`, {
        query: cleanObject({ program_id: opts.programId }),
      });
      printPayload(cmd, payload);
    });
  });

realms
  .command('members')
  .argument('<realm_id>')
  .option('--program-id <programId>')
  .option('--mint <mint>')
  .option('--min-voting-power <number>')
  .option('--include-inactive')
  .option('--limit <number>')
  .option('--cursor <cursor>')
  .option('--sort-by <field>')
  .option('--sort-order <order>')
  .action(async (realmId, opts, cmd) => {
    await run(cmd, async () => {
      const payload = await apiRequest(cmd, 'GET', `/realms/${realmId}/members`, {
        query: cleanObject({
          program_id: opts.programId,
          mint: opts.mint,
          min_voting_power: opts.minVotingPower,
          include_inactive: opts.includeInactive ? 'true' : undefined,
          limit: opts.limit,
          cursor: opts.cursor,
          sort_by: opts.sortBy,
          sort_order: opts.sortOrder,
        }),
      });
      printPayload(cmd, payload);
    });
  });

realms
  .command('treasury')
  .argument('<realm_id>')
  .option('--program-id <programId>')
  .action(async (realmId, opts, cmd) => {
    await run(cmd, async () => {
      const payload = await apiRequest(cmd, 'GET', `/realms/${realmId}/treasury`, {
        query: cleanObject({ program_id: opts.programId }),
      });
      printPayload(cmd, payload);
    });
  });

realms
  .command('wallets')
  .argument('<realm_id>')
  .option('--program-id <programId>')
  .option('--limit <number>')
  .option('--cursor <cursor>')
  .action(async (realmId, opts, cmd) => {
    await run(cmd, async () => {
      const payload = await apiRequest(cmd, 'GET', `/realms/${realmId}/wallets`, {
        query: cleanObject({
          program_id: opts.programId,
          limit: opts.limit,
          cursor: opts.cursor,
        }),
      });
      printPayload(cmd, payload);
    });
  });

realms
  .command('participants')
  .argument('<realm_id>')
  .option('--program-id <programId>')
  .option('--mode <mode>', 'latest|days')
  .option('--proposal-count <number>')
  .option('--days <number>')
  .option('--min-vote-weight <number>')
  .option('--min-staked-weight <number>')
  .option('--format <format>', 'json|csv')
  .action(async (realmId, opts, cmd) => {
    await run(cmd, async () => {
      const format = opts.format || getGlobalOptions(cmd).output;
      const asCsv = String(format || '').toLowerCase() === 'csv';
      if (asCsv) {
        const csv = await apiRequest(cmd, 'GET', `/realms/${realmId}/participants`, {
          query: cleanObject({
            program_id: opts.programId,
            mode: opts.mode,
            proposal_count: opts.proposalCount,
            days: opts.days,
            min_vote_weight: opts.minVoteWeight,
            min_staked_weight: opts.minStakedWeight,
            format: 'csv',
          }),
          expectText: true,
        });
        console.log(csv);
        return;
      }
      const payload = await apiRequest(cmd, 'GET', `/realms/${realmId}/participants`, {
        query: cleanObject({
          program_id: opts.programId,
          mode: opts.mode,
          proposal_count: opts.proposalCount,
          days: opts.days,
          min_vote_weight: opts.minVoteWeight,
          min_staked_weight: opts.minStakedWeight,
          format: 'json',
        }),
      });
      printPayload(cmd, payload);
    });
  });

const proposals = program.command('proposals').description('Proposal commands');

proposals
  .command('list')
  .requiredOption('--realm <realmId>')
  .option('--program-id <programId>')
  .option('--state <state>')
  .option('--from-ts <number>')
  .option('--to-ts <number>')
  .option('--limit <number>')
  .option('--cursor <cursor>')
  .option('--sort-by <field>')
  .option('--sort-order <order>')
  .action(async (opts, cmd) => {
    await run(cmd, async () => {
      const payload = await apiRequest(cmd, 'GET', `/realms/${opts.realm}/proposals`, {
        query: cleanObject({
          program_id: opts.programId,
          state: opts.state,
          from_ts: opts.fromTs,
          to_ts: opts.toTs,
          limit: opts.limit,
          cursor: opts.cursor,
          sort_by: opts.sortBy,
          sort_order: opts.sortOrder,
        }),
      });
      printPayload(cmd, payload);
    });
  });

proposals
  .command('get')
  .argument('<proposal_id>')
  .option('--realm-id <realmId>')
  .option('--program-id <programId>')
  .action(async (proposalId, opts, cmd) => {
    await run(cmd, async () => {
      const payload = await apiRequest(cmd, 'GET', `/proposals/${proposalId}`, {
        query: cleanObject({
          realm_id: opts.realmId,
          program_id: opts.programId,
        }),
      });
      printPayload(cmd, payload);
    });
  });

proposals
  .command('instructions')
  .argument('<proposal_id>')
  .option('--realm-id <realmId>')
  .option('--program-id <programId>')
  .action(async (proposalId, opts, cmd) => {
    await run(cmd, async () => {
      const payload = await apiRequest(cmd, 'GET', `/proposals/${proposalId}/instructions`, {
        query: cleanObject({
          realm_id: opts.realmId,
          program_id: opts.programId,
        }),
      });
      printPayload(cmd, payload);
    });
  });

proposals
  .command('votes')
  .argument('<proposal_id>')
  .option('--realm-id <realmId>')
  .option('--program-id <programId>')
  .option('--side <side>')
  .option('--min-weight <number>')
  .option('--limit <number>')
  .option('--cursor <cursor>')
  .action(async (proposalId, opts, cmd) => {
    await run(cmd, async () => {
      const payload = await apiRequest(cmd, 'GET', `/proposals/${proposalId}/votes`, {
        query: cleanObject({
          realm_id: opts.realmId,
          program_id: opts.programId,
          side: opts.side,
          min_weight: opts.minWeight,
          limit: opts.limit,
          cursor: opts.cursor,
        }),
      });
      printPayload(cmd, payload);
    });
  });

proposals
  .command('events')
  .argument('<proposal_id>')
  .option('--realm-id <realmId>')
  .option('--program-id <programId>')
  .option('--limit <number>')
  .option('--cursor <cursor>')
  .action(async (proposalId, opts, cmd) => {
    await run(cmd, async () => {
      const payload = await apiRequest(cmd, 'GET', `/proposals/${proposalId}/events`, {
        query: cleanObject({
          realm_id: opts.realmId,
          program_id: opts.programId,
          limit: opts.limit,
          cursor: opts.cursor,
        }),
      });
      printPayload(cmd, payload);
    });
  });

const events = program.command('events').description('Realtime and event feed commands');

events
  .command('list')
  .option('--realm-id <realmId>')
  .option('--event-type <eventType>')
  .option('--from-ts <number>')
  .option('--to-ts <number>')
  .option('--limit <number>')
  .option('--cursor <cursor>')
  .action(async (opts, cmd) => {
    await run(cmd, async () => {
      const payload = await apiRequest(cmd, 'GET', '/events/proposals', {
        query: cleanObject({
          realm_id: opts.realmId,
          event_type: opts.eventType,
          from_ts: opts.fromTs,
          to_ts: opts.toTs,
          limit: opts.limit,
          cursor: opts.cursor,
        }),
      });
      printPayload(cmd, payload);
    });
  });

events
  .command('tail')
  .option('--realm-id <realmId>')
  .option('--event-type <eventType>')
  .option('--limit <number>')
  .action(async (opts, cmd) => {
    await run(cmd, async () => {
      const payload = await apiRequest(cmd, 'GET', '/events/proposals/stream', {
        query: cleanObject({
          realm_id: opts.realmId,
          event_type: opts.eventType,
          limit: opts.limit,
        }),
        expectText: true,
      });
      console.log(payload);
    });
  });

const notifications = program.command('notifications').description('Notification commands');

notifications
  .command('subscribe')
  .requiredOption('--realm-id <realmId>')
  .requiredOption('--token <token>')
  .option('--disable', 'Disable instead of enable')
  .action(async (opts, cmd) => {
    await run(cmd, async () => {
      const payload = await apiRequest(cmd, 'POST', '/notifications/subscriptions', {
        body: {
          realm_id: opts.realmId,
          token: opts.token,
          enabled: !opts.disable,
        },
      });
      printPayload(cmd, payload);
    });
  });

notifications
  .command('unsubscribe')
  .requiredOption('--realm-id <realmId>')
  .requiredOption('--token <token>')
  .action(async (opts, cmd) => {
    await run(cmd, async () => {
      const payload = await apiRequest(cmd, 'DELETE', '/notifications/subscriptions', {
        body: {
          realm_id: opts.realmId,
          token: opts.token,
        },
      });
      printPayload(cmd, payload);
    });
  });

notifications
  .command('scan')
  .option('--realm-id <realmIds...>')
  .option('--dry-run')
  .action(async (opts, cmd) => {
    await run(cmd, async () => {
      const payload = await apiRequest(cmd, 'POST', '/notifications/scan', {
        body: cleanObject({
          realm_ids: opts.realmId || [],
          dry_run: opts.dryRun ? true : false,
        }),
      });
      printPayload(cmd, payload);
    });
  });

notifications
  .command('test')
  .requiredOption('--realm-id <realmId>')
  .requiredOption('--token <token>')
  .option('--title <title>')
  .option('--body <message>')
  .action(async (opts, cmd) => {
    await run(cmd, async () => {
      const payload = await apiRequest(cmd, 'POST', '/notifications/test', {
        body: cleanObject({
          realm_id: opts.realmId,
          token: opts.token,
          title: opts.title,
          body: opts.body,
        }),
      });
      printPayload(cmd, payload);
    });
  });

program.parseAsync(process.argv);
