// src/renderer/components/ui/TTTitle.tsx

import React from "react";
import "./TTTitle.css";
import divider from "/title-divider.png";

/**
 * Premium TanzaniaTours-style seksjonstittel
 * Brukes i:
 * - Bygg Reiseprogram
 * - Flyrobott
 * - Malbibliotek
 */
export default function TTTitle({ children }: { children: string }) {
  return (
    <div className="tt-divider-block">

      <div className="tt-divider-title">
        {children}
      </div>

      <div className="tt-divider-lines">
        <div className="tt-divider-line" />
        <img src={divider} className="tt-divider-icon" />
        <div className="tt-divider-line" />
      </div>

    </div>
  );
}
