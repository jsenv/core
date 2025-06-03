/**
 * each section should have its own scrollbar
 * right now it does not work, the content is not scrollable and gets hidden
 */

import { initFlexDetailsSet } from "@jsenv/dom";
import { useCallback, useLayoutEffect, useRef, useState } from "preact/hooks";
import "./explorer.css" with { type: "css" };
import {
  ExplorerDatabases,
  databaseExplorerGroupController,
} from "./explorer_databases.jsx";
import {
  ExplorerRoles,
  rolesExplorerGroupController,
} from "./explorer_roles.jsx";

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

  useLayoutEffect(() => {
    const flexDetailsSet = initFlexDetailsSet(flexDetailsSetRef.current, {
      onRequestedSizeChange: (element, requestedHeight) => {
        if (element.id === databaseExplorerGroupController.id) {
          databaseExplorerGroupController.setHeightSetting(requestedHeight);
        }
        if (element.id === rolesExplorerGroupController.id) {
          rolesExplorerGroupController.setHeightSetting(requestedHeight);
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
      <ExplorerDatabases onOpen={onOpen} onClose={onClose} />
      <ExplorerRoles onOpen={onOpen} onClose={onClose} resizable={resizable} />
    </div>
  );
};
