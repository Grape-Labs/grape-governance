const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { transformSync } = require('@babel/core');
const mod = { exports: {} };
new Function('module', 'exports', transformSync(fs.readFileSync('src/Governance/Demo/proposalListStatus.ts', 'utf8'), {
  filename: 'proposalListStatus.ts', configFile: false, babelrc: false,
  presets: ['@babel/preset-typescript'], plugins: ['@babel/plugin-transform-modules-commonjs'],
}).code)(mod, mod.exports);
const { recordedVoteLabel, proposalListStatus } = mod.exports;
const account = (yes, no, rest = {}) => ({ state: 2, options: [{ voteWeight: yes }], denyVoteWeight: no, ...rest });
test('records distinguish choices, legacy records, and unknown choices', () => {
  for (const [voteType, label] of [[0,'Voted For'],[1,'Voted Against'],[2,'Abstained'],[3,'Voted Veto']])
    assert.equal(recordedVoteLabel({account:{vote:{voteType}}}),label);
  assert.equal(recordedVoteLabel({account:{voteWeight:{no:'15'}}}), 'Voted Against');
  assert.equal(recordedVoteLabel({account:{}}), 'Voted');
  assert.equal(recordedVoteLabel({account:{vote:{voteType:0,approveChoices:[{weightPercentage:0},{weightPercentage:100}]}}},{options:[{label:'A'},{label:'B'}]}), 'Voted: B');
});
test('lead is not described as passing when threshold is missing', () => {
  const result = proposalListStatus(account('80','20'));
  assert.equal(result.label, 'For leads · 80.0% For');
  assert.match(result.detail, /60.0 percentage-point lead/);
  assert.match(result.detail, /threshold unavailable/);
});
test('passing needs approval threshold AND more For than Against', () => {
  const rules = {maxVoteWeight:'1000',voteThreshold:{type:0,value:60}};
  assert.match(proposalListStatus(account('700','100',rules)).label,/^Passing/);
  assert.match(proposalListStatus(account('500','100',rules)).label,/^Not passing/);
  assert.match(proposalListStatus(account('700','700',rules)).label,/^Not passing/);
  assert.match(proposalListStatus(account('600','100',rules)).label,/^Passing/);
});
test('handles zero, ties, large integer weights and unsupported cases safely', () => {
  assert.equal(proposalListStatus(account('0','0')).label,'No votes yet');
  assert.equal(proposalListStatus(account('20','20')).label,'Tied · 50.0% For');
  assert.equal(proposalListStatus(account('80000000000000000000','20000000000000000000')).label,'For leads · 80.0% For');
  assert.equal(proposalListStatus(account(Number.MAX_SAFE_INTEGER+1,0)),null);
  assert.equal(proposalListStatus(account(1,0,{state:5})),null);
  assert.equal(proposalListStatus(account(1,0,{options:[{},{}]})),null);
});
test('sentiment deduplicates wallets and excludes withdrawn votes', () => {
  const row = (owner, kind, extra = {}) => ({account:{governingTokenOwner:owner,vote:{voteType:kind},...extra}});
  assert.deepEqual(mod.exports.distinctVoterSentiment([
    row('a',0),row('a',0),row('b',1),row('c',2),row('d',0,{isRelinquished:true}),
    {governingTokenOwner:'e',vote:{legacyYes:12}},
    row(null,0),
  ]), {total:4,for:2,against:1,other:1});
});
test('all voting proposals lead, ordered by voting start rather than draft age', () => {
  const proposal = (id, state, draftAt, votingAt) => ({ id, account: { state, draftAt, votingAt } });
  const oldDraft = proposal('old-draft-new-vote', 0, 1);
  const rows = [
    proposal('completed', 5, 900, 950),
    proposal('new-draft', 0, 1000),
    proposal('older-vote', 2, 500, 600),
    oldDraft,
    proposal('missing-start', 2, 100),
  ];
  oldDraft.account.state = 2;
  oldDraft.account.votingAt = 800;
  assert.deepEqual(rows.sort(mod.exports.compareProposalPriority).map(row => row.id),
    ['old-draft-new-vote','older-vote','missing-start','new-draft','completed']);
});
