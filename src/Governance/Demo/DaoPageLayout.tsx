import React from "react";
import GrapeDaoNavigation, { DaoSection } from "./GrapeDaoNavigation";
import "./governance-demo.css";

export default function DaoPageLayout({
  section = "proposals",
  title,
  description,
  children,
  governanceAddress,
}: {
  governanceAddress?: string;
  section?: DaoSection;
  title?: string;
  description?: string;
  experimental?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="governance-demo gd-live">
      <div className="gd-shell">
        <GrapeDaoNavigation section={section} governanceAddress={governanceAddress} />
        {title && (
          <div className="gd-intro">
            <span className="gd-eyebrow">GRAPE GOVERNANCE</span>
            <h1>{title}</h1>
            <p>{description}</p>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
