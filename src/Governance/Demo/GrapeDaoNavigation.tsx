import React from "react";
import { NavLink } from "react-router-dom";
import "./governance-demo.css";

const realm = "By2sVGZXwfQq6rAiAM3rNPJ9iQfb5e2QhnF4YjJ4Bip";
export default function GrapeDaoNavigation({
  advanced = false,
}: {
  advanced?: boolean;
}) {
  return (
    <nav className="gd-dao-nav" aria-label="Grape DAO navigation">
      <NavLink
        to={`/dao/${realm}`}
        className={!advanced ? "is-current" : undefined}
      >
        Proposals
      </NavLink>
      <NavLink to={`/members/${realm}`}>Members</NavLink>
      <NavLink to={`/treasury/${realm}`}>Treasury</NavLink>
      <NavLink to={`/reputation/${realm}`}>Reputation</NavLink>
      <NavLink to={`/stats/${realm}`}>Stats</NavLink>
      <NavLink
        to={`/governance/${realm}`}
        className={advanced ? "is-current" : undefined}
      >
        Advanced
      </NavLink>
    </nav>
  );
}
