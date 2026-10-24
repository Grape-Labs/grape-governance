import React from "react";
import { useParams } from "react-router-dom";
import DaoPageLayout from "./DaoPageLayout";
import { GovernanceMembersView } from "../GovernanceMembers";
import { GovernanceTreasuryView } from "../GovernanceTreasury";
import { GovernanceStatsView } from "../GovernanceStats";
function VineReputationView({ governanceAddress }: any) {
  return (
    <div className="gd-main gd-content">
      <p>DAO reputation is available on Vine / OG Reputation.</p>
      <a
        href={`https://vine.governance.so/dao/${governanceAddress}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        Open Vine / OG Reputation ↗
      </a>
    </div>
  );
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
    title: "Vine / OG Reputation",
    description: "Community contributions and reputation.",
    View: VineReputationView,
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
