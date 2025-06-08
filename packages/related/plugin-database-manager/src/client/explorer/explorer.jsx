/**
 * each section should have its own scrollbar
 * right now it does not work, the content is not scrollable and gets hidden
 */

import { initFlexDetailsSet } from "@jsenv/dom";
import { useCallback, useLayoutEffect, useRef, useState } from "preact/hooks";
import { FontSizedSvg } from "../components/font_sized_svg.jsx";
import { pickRoleIcon } from "../role/role_icons.jsx";
import { useCurrentRole } from "../role/role_signals.js";
import "./explorer.css" with { type: "css" };
import {
  // ExplorerDatabases,
  databaseExplorerGroupController,
} from "./explorer_databases.jsx";
import {
  // ExplorerTables,
  tablesExplorerGroupController,
} from "./explorer_tables.jsx";
import {
  ExplorerOwners,
  ownersExplorerGroupController,
} from "./owners/explorer_owners.jsx";
import {
  ExplorerRoles,
  rolesExplorerGroupController,
} from "./roles/explorer_roles.jsx";

export const Explorer = () => {
  const role = useCurrentRole();
  const Icon = pickRoleIcon(role);

  return (
    <nav className="explorer">
      <div className="explorer_head">
        <FontSizedSvg>
          <Icon />
        </FontSizedSvg>
        <select style="margin-top: 10px; margin-bottom: 10px; margin-left: 10px;">
          <option selected>{role.rolname}</option>
        </select>
      </div>
      <ExplorerBody />
      <div className="explorer_foot"></div>
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

  useLayoutEffect(() => {
    const flexDetailsSet = initFlexDetailsSet(flexDetailsSetRef.current, {
      onRequestedSizeChange: (element, requestedHeight) => {
        if (element.id === tablesExplorerGroupController.id) {
          tablesExplorerGroupController.setHeightSetting(requestedHeight);
        }
        if (element.id === databaseExplorerGroupController.id) {
          databaseExplorerGroupController.setHeightSetting(requestedHeight);
        }
        if (element.id === rolesExplorerGroupController.id) {
          rolesExplorerGroupController.setHeightSetting(requestedHeight);
        }
        if (element.id === ownersExplorerGroupController.id) {
          ownersExplorerGroupController.setHeightSetting(requestedHeight);
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
      {/* <ExplorerTables onOpen={onOpen} onClose={onClose} />
      <ExplorerDatabases
        onOpen={onOpen}
        onClose={onClose}
        resizable={resizable}
      /> */}
      <ExplorerRoles onOpen={onOpen} onClose={onClose} />
      <ExplorerOwners onOpen={onOpen} onClose={onClose} resizable={resizable} />
    </div>
  );
};
