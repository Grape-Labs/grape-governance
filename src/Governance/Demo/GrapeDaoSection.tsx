import React from "react";
import { Link, useParams } from "react-router-dom";
import DaoPageLayout from "./DaoPageLayout";
import { GovernanceMembersView } from "../GovernanceMembers";
import { GovernanceTreasuryView } from "../GovernanceTreasury";
import { GovernanceStatsView } from "../GovernanceStats";
function OgReputationView({ governanceAddress }: any) {
  const enabled = governanceAddress === "By2sVGZXwfQq6rAiAM3rNPJ9iQfb5e2QhnF4YjJ4Bip";
  return <div className="gd-main gd-content gd-reputation-onboarding">
    <span className="gd-eyebrow">OG REPUTATION</span>
    <h2>{enabled ? 'Your community’s contributions' : 'Bring contribution-based reputation to your DAO'}</h2>
    {enabled ? <>
      <p>Explore your DAO’s member reputation and seasons.</p>
      <a className="gd-secondary" href={`https://vine.governance.so/dao/${governanceAddress}`} target="_blank" rel="noopener noreferrer">Open OG Reputation ↗</a>
    </> : <>
      <p>Recognize contributions with points and seasons managed by your DAO. OG Reputation is not enabled for this DAO in the directory yet.</p>
      <ol className="gd-reputation-steps">
        <li><h3>Define what earns reputation</h3><p>Agree on contributions to recognize, who reviews them, and how points are awarded each season.</p></li>
        <li><h3>Prepare your reputation space</h3><p>Choose the DAO treasury that will manage the space, a REP mint, and an initial season. Your DAO address is:</p><code>{governanceAddress}</code></li>
        <li><h3>Propose and activate</h3><p>From your treasury’s extensions, open IntraDAO tools → OG Reputation Spaces and choose Initialize Space. Review the configuration, then create a governance proposal. The space is initialized after the proposal passes and its instruction is executed.</p></li>
      </ol>
      <Link className="gd-secondary" to={`/treasury/${governanceAddress}`}>Continue to treasury setup →</Link>
      <p className="gd-footnote">This guide does not enable reputation or submit a transaction. After setup, the directory integration must also be enabled for your DAO.</p>
    </>}
  </div>;
}
const pages = {
  members: {
    title: "Members",
    description: "Voting power, delegation, and member grants.",
    View: GovernanceMembersView,
  },
  treasury: {
    title: "Treasury",
    description: "Assets, balances, and treasury actions.",
    View: GovernanceTreasuryView,
  },
  stats: {
    title: "Stats",
    description: "Participation and governance activity.",
    View: GovernanceStatsView,
  },
  reputation: {
    title: "OG Reputation",
    description: "Community contributions and reputation.",
    View: OgReputationView,
  },
};
export default function GrapeDaoSection({
  section,
}: {
  section: keyof typeof pages;
}) {
  const route = useParams();
  const realm = route.handlekey || route.governance || route.address || "By2sVGZXwfQq6rAiAM3rNPJ9iQfb5e2QhnF4YjJ4Bip";
  const { title, description, View } = pages[section];
  return (
    <DaoPageLayout governanceAddress={realm} section={section} title={title} description={description}>
      <main className="gd-section-content">
        <View
          compactLayout
          showGovernanceNavigation={false}
          key={realm}
          governanceAddress={realm}
        />
      </main>
    </DaoPageLayout>
  );
}
