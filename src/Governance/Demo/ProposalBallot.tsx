import React from 'react';
import { VoteForProposal } from '../GovernanceVote';
import { ballotRules, validateBallot } from '../../utils/governanceTools/ballotRules';
import { formatVoterPower } from './VoterBreakdown';

export default function ProposalBallot(props: any) {
  const account = props.thisitem.account;
  const rules = ballotRules(account);
  const [weights, setWeights] = React.useState<number[]>(() => rules.options.map(() => 0));
  const error = validateBallot(account, weights);
  const selected = weights.filter(value => value > 0).length;
  const total = weights.reduce((sum, value) => sum + value, 0);
  const active = Number(account.state) === 2;
  const power = (value: any) => {
    if (props.decimals == null || value == null) return 'Unavailable';
    const digits = value.toString().padStart(props.decimals + 1, '0');
    return formatVoterPower(props.decimals ? `${digits.slice(0, -props.decimals)}.${digits.slice(-props.decimals)}` : digits);
  };
  if (!rules.supported) return <p role="status">This proposal uses an unsupported ballot configuration. Voting is unavailable.</p>;
  return <div className="gd-ballot">
    <h3>{rules.poll ? 'Poll' : 'Proposal choices'}</h3>
    <p>{rules.weighted ? 'Distribute 100% of your voting power across your choices.' : rules.multiple
      ? `Choose ${rules.min === rules.max ? rules.min : `${rules.min}–${rules.max}`} options. Each receives your full voting power.`
      : 'Choose one option.'}</p>
    <fieldset disabled={!active || !!props.castDisabledReason}>
      <legend>Voting options</legend>
      {rules.options.map((option: any, index: number) => <label className="gd-ballot-option" key={index}>
        {!rules.weighted && <input type={rules.multiple ? 'checkbox' : 'radio'} name="proposal-choice" checked={weights[index] > 0}
          onChange={event => setWeights(previous => previous.map((weight, i) => i === index ? (event.target.checked ? 100 : 0) : rules.multiple ? weight : 0))} />}
        <span><strong>{option.label}</strong><small>{power(option.voteWeight)} voting power</small></span>
        {rules.weighted && <span className="gd-ballot-weight"><input type="number" min={0} max={100} step={1} value={Number.isNaN(weights[index]) ? '' : weights[index]}
          aria-label={`${option.label} allocation percent`} onChange={event => setWeights(previous => previous.map((weight, i) => i === index ? (event.target.value === '' ? 0 : Number(event.target.value)) : weight))} />%</span>}
      </label>)}
    </fieldset>
    {rules.canDeny && <p>Against: {power(account.denyVoteWeight)} voting power</p>}
    {active && <>
      <p role="status">{props.castDisabledReason || (rules.weighted ? `${total}% allocated · ` : `${selected} selected · `) + (error || 'Ready to vote')}</p>
      <div className="gd-ballot-actions">
        <VoteForProposal {...props} title="Choices" subtitle="Your ballot" showIcon actionOnly type={0} multiChoice={{ proposal: props.thisitem, weights }}
          ballotLabel={props.hasVoted ? 'Manage vote / vote with delegates' : 'Submit choices'}
          castDisabledReason={props.castDisabledReason || error} />
        {rules.canDeny && <VoteForProposal {...props} title="Against" subtitle="Reject this proposal" showIcon actionOnly type={1} castDisabledReason={props.denyDisabledReason} />}
      </div>
    </>}
    {!active && <>
      <p role="status">Voting is closed. Recorded results are shown above.</p>
      {props.hasVoted && <VoteForProposal {...props} title="Recorded vote" subtitle="Manage vote" showIcon actionOnly type={props.hasVotedSide === 'no' ? 1 : 0} ballotLabel="Manage recorded vote" />}
    </>}
  </div>;
}
