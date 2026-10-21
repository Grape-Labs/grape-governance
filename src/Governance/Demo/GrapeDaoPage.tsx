import React from "react";
import { useSearchParams } from "react-router-dom";
import GovernanceDemo from "./GovernanceDemo";
import GrapeDaoNavigation from "./GrapeDaoNavigation";
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
      <>
        <GrapeDaoNavigation advanced />
        <GovernanceCachedView governanceAddress="By2sVGZXwfQq6rAiAM3rNPJ9iQfb5e2QhnF4YjJ4Bip" />
      </>
    );
  if (params.get("view") === "advanced")
    return (
      <>
        <GrapeDaoNavigation advanced />
        <GovernanceProposalWrapper governanceAddress="By2sVGZXwfQq6rAiAM3rNPJ9iQfb5e2QhnF4YjJ4Bip" />
      </>
    );
  return <GovernanceDemo landing />;
}
