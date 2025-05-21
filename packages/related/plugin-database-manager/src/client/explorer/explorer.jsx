/**
 * each section should have its own scrollbar
 * right now it does not work, the content is not scrollable and gets hidden
 */

import "@jsenv/dom/details_content_scroll";
import "@jsenv/dom/resize";
import { effect } from "@preact/signals";
import { useCallback, useState } from "preact/hooks";
import { setCurrentDatabase } from "../database/database_signals.js";
import { databaseStore } from "../database/database_store.js";
import { setCurrentRole } from "../role/role_signals.js";
import { roleStore } from "../role/role_store.js";
import "./explorer.css" with { type: "css" };
import { ExplorerDatabases } from "./explorer_databases.jsx";
import { ExplorerRoles } from "./explorer_roles.jsx";

effect(async () => {
  const response = await fetch(`/.internal/database/api/nav`);
  const { currentRole, roles, currentDatabase, databases } =
    await response.json();
  setCurrentRole(currentRole);
  setCurrentDatabase(currentDatabase);
  databaseStore.upsert(databases);
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
  const onOpen = useCallback(() => {
    setDetailsOpenCount((count) => count + 1);
  }, []);
  const onClose = useCallback(() => {
    setDetailsOpenCount((count) => count - 1);
  }, []);

  // first thing: I need to repartir la hauteur aux groupes ouvert
  // si plus d'un groupe est ouvert alors on peut les resize

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
      <ExplorerDatabases
        onOpen={onOpen}
        onClose={onClose}
        resizable={resizable}
      />
      <ExplorerRoles onOpen={onOpen} onClose={onClose} resizable={false} />
    </div>
  );
};
