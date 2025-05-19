/**
 * each section should have its own scrollbar
 * right now it does not work, the content is not scrollable and gets hidden
 */

import { effect } from "@preact/signals";
import { useState } from "preact/hooks";
import { setCurrentRole } from "../role/role_signals.js";
import { roleStore } from "../role/role_store.js";
import "./details_content_scroll.js";
import "./explorer.css" with { type: "css" };
import { ExplorerDatabases } from "./explorer_databases.jsx";
import { ExplorerRoles } from "./explorer_roles.jsx";

effect(async () => {
  const response = await fetch(`/.internal/database/api/nav`);
  const { currentRole, roles } = await response.json();
  setCurrentRole(currentRole);
  roleStore.upsert(roles);
});

export const Explorer = () => {
  return (
    <nav className="explorer">
      <div className="explorer_head">
        <h2>Explorer</h2>
      </div>
      <ExplorerBody />
    </nav>
  );
};

const ExplorerBody = () => {
  const [detailsOpenCount, setDetailsOpenCount] = useState(0);
  const resizable = detailsOpenCount > 1;

  return (
    <div
      className="explorer_body"
      onToggle={(toggleEvent) => {
        if (toggleEvent.newState === "open") {
          setDetailsOpenCount((count) => count + 1);
        } else {
          setDetailsOpenCount((count) => count - 1);
        }
      }}
    >
      <ExplorerDatabases id="databases_explorer" resizable={resizable} />
      <ExplorerRoles id="roles_explorer" resizable={resizable} />
    </div>
  );
};
