import React from "react";
import { useSearchParams } from "react-router-dom";
import GovernanceDemo from "./GovernanceDemo";
import DaoPageLayout from "./DaoPageLayout";
import { GovernanceCachedView } from "../Governance";
import { GovernanceProposalWrapper } from "../GovernanceProposalWrapper";

export default function GrapeDaoPage({
  advanced = false,
}: {
  advanced?: boolean;
}) {
  const [params] = useSearchParams();
  if (advanced)
    return (
      <DaoPageLayout
        section="advanced"
        title="Advanced"
        description="All governance tools and configuration."
      >
        <main className="gd-section-content">
          <GovernanceCachedView
            showGovernanceNavigation={false}
            governanceAddress="By2sVGZXwfQq6rAiAM3rNPJ9iQfb5e2QhnF4YjJ4Bip"
          />
        </main>
      </DaoPageLayout>
    );
  if (params.get("view") === "advanced")
    return (
      <DaoPageLayout
        section="advanced"
        title="Advanced"
        description="All governance tools and configuration."
      >
        <main className="gd-section-content">
          <GovernanceProposalWrapper governanceAddress="By2sVGZXwfQq6rAiAM3rNPJ9iQfb5e2QhnF4YjJ4Bip" />
        </main>
      </DaoPageLayout>
    );
  return <GovernanceDemo landing />;
}
