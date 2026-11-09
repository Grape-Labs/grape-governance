import { useCouncilDelegation } from "./useCouncilDelegation";
import React from "react";
import { Menu, MenuItem, useMediaQuery } from "@mui/material";
import HowToVoteOutlinedIcon from "@mui/icons-material/HowToVoteOutlined";
import PeopleOutlineIcon from "@mui/icons-material/PeopleOutline";
import AccountBalanceWalletOutlinedIcon from "@mui/icons-material/AccountBalanceWalletOutlined";
import BarChartOutlinedIcon from "@mui/icons-material/BarChartOutlined";
import WorkspacePremiumOutlinedIcon from "@mui/icons-material/WorkspacePremiumOutlined";
import MoreHorizIcon from "@mui/icons-material/MoreHoriz";
import { Link, useParams, useSearchParams } from "react-router-dom";

const defaultRealm = "By2sVGZXwfQq6rAiAM3rNPJ9iQfb5e2QhnF4YjJ4Bip";
export type DaoSection =
  | "council"
  | "proposals"
  | "members"
  | "treasury"
  | "reputation"
  | "stats"
  | "advanced";
export default function GrapeDaoNavigation({
  section = "proposals",
  advanced = false,
  governanceAddress,
}: {
  governanceAddress?: string;
  section?: DaoSection;
  advanced?: boolean;
}) {
  const route = useParams();
  const [params] = useSearchParams();
  const realm = governanceAddress || route.governance || route.handlekey || route.address || defaultRealm;
  const council = useCouncilDelegation(realm);
  const mobile = useMediaQuery("(max-width:950px)");
  const [menuAnchor, setMenuAnchor] = React.useState<HTMLElement | null>(null);
  const icons = { proposals: HowToVoteOutlinedIcon, members: PeopleOutlineIcon,
    council: PeopleOutlineIcon, treasury: AccountBalanceWalletOutlinedIcon, stats: BarChartOutlinedIcon, advanced: MoreHorizIcon };
  const oldUi = advanced || section === "advanced";
  const current = oldUi ? "advanced" : section;
  const proposal = route.proposal || params.get("proposal");
  const toggleParams = new URLSearchParams(params);
  toggleParams.delete("proposal");
  if (oldUi) toggleParams.delete("view");
  else toggleParams.set("view", "advanced");
  const togglePath = proposal ? `/proposal/${realm}/${proposal}` : `/dao/${realm}`;
  const toggleQuery = toggleParams.toString();
  const toggleUrl = `${togglePath}${toggleQuery ? `?${toggleQuery}` : ""}`;
  const toggleLabel = oldUi ? "Switch to new UI" : "Switch to old UI";
  return (
    <nav className="gd-dao-nav" aria-label="DAO navigation">
      {(
        [
          ["proposals", "Proposals", "dao"],
          ["members", "Members", "members"],
          ["treasury", "Treasury", "treasury"],
          ["stats", "Stats", "stats"],
          ["council", "Council", "council"],
          ["advanced", toggleLabel, "governance"],
        ] as const
      ).filter(([key]) => (key !== "council" || council.allowed) && (!mobile || (key !== "advanced" && key !== "council"))).map(([key, label, path]) => (
        <Link
          key={key}
          to={key === "advanced" ? toggleUrl : `/${path}/${realm}`}
          className={`${current === key && key !== "advanced" ? "is-current" : ""} ${
            key === "advanced" ? "gd-old-view" : ""
          }`}
          aria-current={current === key && key !== "advanced" ? "page" : undefined}
        >
          {mobile && React.createElement(icons[key], { className: "gd-nav-icon", "aria-hidden": true })}
          <span>{label}</span>
        </Link>
      ))}
      {realm === defaultRealm ? <a
        className="gd-vine-link"
        href={`https://vine.governance.so/dao/${realm}`}
        target="_blank"
        rel="noopener noreferrer"
      >
        {mobile && <WorkspacePremiumOutlinedIcon className="gd-nav-icon" aria-hidden="true" />}
        <span>{mobile ? "Reputation" : "OG Reputation"} <span>↗</span></span>
      </a> : <Link to={`/reputation/${realm}`} className={`gd-vine-link ${section === "reputation" ? "is-current" : ""}`}
        aria-current={section === "reputation" ? "page" : undefined}>
        {mobile && <WorkspacePremiumOutlinedIcon className="gd-nav-icon" aria-hidden="true" />}
        <span>{mobile ? "Add OG" : "Add OG Reputation"}</span>
      </Link>}
      {mobile && <>
        <button className="gd-nav-more" type="button" aria-label="More navigation options"
          aria-haspopup="menu" aria-expanded={!!menuAnchor} aria-controls={menuAnchor ? "gd-nav-overflow" : undefined}
          onClick={event => setMenuAnchor(event.currentTarget)}><MoreHorizIcon aria-hidden="true" /></button>
        <Menu id="gd-nav-overflow" anchorEl={menuAnchor} open={!!menuAnchor} onClose={() => setMenuAnchor(null)}
          PaperProps={{ sx: { bgcolor: "#141e2b", color: "#edf2fa", border: "1px solid #ffffff20", borderRadius: 2 } }}>
          {council.allowed && <MenuItem component={Link} to={`/council/${realm}`} onClick={() => setMenuAnchor(null)} aria-current={current === "council" ? "page" : undefined}>Council delegation</MenuItem>}
          <MenuItem component={Link} to={toggleUrl} onClick={() => setMenuAnchor(null)}>{toggleLabel}</MenuItem>
        </Menu>
      </>}
    </nav>
  );
}
