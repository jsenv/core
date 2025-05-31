/**
 * each section should have its own scrollbar
 * right now it does not work, the content is not scrollable and gets hidden
 */

import { initFlexDetailsSet } from "@jsenv/dom";
import { effect } from "@preact/signals";
import { useCallback, useLayoutEffect, useRef, useState } from "preact/hooks";
import { setCurrentDatabase } from "../database/database_signals.js";
import { databaseStore } from "../database/database_store.js";
import { setCurrentRole } from "../role/role_signals.js";
import { roleStore } from "../role/role_store.js";
import "./explorer.css" with { type: "css" };
import {
  ExplorerDatabases,
  databaseExplorerGroupController,
} from "./explorer_databases.jsx";
import {
  ExplorerRoles,
  rolesExplorerGroupController,
} from "./explorer_roles.jsx";

effect(async () => {
  const response = await fetch(`${window.DB_MANAGER_CONFIG.apiUrl}/nav`);
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
  const flexDetailsSetRef = useRef();

  const databaseDetailsHeight =
    databaseExplorerGroupController.useHeightSetting();
  const rolesDetailsHeight = rolesExplorerGroupController.useHeightSetting();

  useLayoutEffect(() => {
    const flexDetailsSet = initFlexDetailsSet(flexDetailsSetRef.current, {
      onSizeChange: (sizeChangeEntries) => {
        for (const { element, value } of sizeChangeEntries) {
          if (element.id === databaseExplorerGroupController.id) {
            databaseExplorerGroupController.setHeightSetting(value);
          }
          if (element.id === rolesExplorerGroupController.id) {
            rolesExplorerGroupController.setHeightSetting(value);
          }
        }
      },
    });
    return flexDetailsSet.cleanup;
  }, []);

  return (
    <div
      ref={flexDetailsSetRef}
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
        height={databaseDetailsHeight}
      />
      <ExplorerRoles
        onOpen={onOpen}
        onClose={onClose}
        height={rolesDetailsHeight}
        resizable={false}
      />
    </div>
  );
};
