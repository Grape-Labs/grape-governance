import React from "react";
import { useSearchParams, useParams } from "react-router-dom";
import GovernanceDemo from "./GovernanceDemo";
import DaoPageLayout from "./DaoPageLayout";
import { GovernanceCachedView } from "../Governance";
import { GovernanceProposalWrapper } from "../GovernanceProposalWrapper";

export default function GrapeDaoPage({
  advanced = false,
}: {
  advanced?: boolean;
}) {
  const route = useParams();
  const realm = route.governance || route.handlekey || "By2sVGZXwfQq6rAiAM3rNPJ9iQfb5e2QhnF4YjJ4Bip";
  const [params] = useSearchParams();
  if (advanced || (!route.proposal && params.get("view") === "advanced"))
    return (
      <DaoPageLayout governanceAddress={realm}
        section="advanced"
        title="Advanced"
        description="All governance tools and configuration."
      >
        <main className="gd-section-content">
          <GovernanceCachedView
            showGovernanceNavigation={false}
            governanceAddress={realm}
          />
        </main>
      </DaoPageLayout>
    );
  if (params.get("view") === "advanced")
    return (
      <DaoPageLayout governanceAddress={realm}
        section="advanced"
        title="Advanced"
        description="All governance tools and configuration."
      >
        <main className="gd-section-content">
          <GovernanceProposalWrapper governanceAddress={realm} />
        </main>
      </DaoPageLayout>
    );
  return <GovernanceDemo key={realm} governanceAddress={realm} landing />;
}
