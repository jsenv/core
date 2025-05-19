/**
 * each section should have its own scrollbar
 * right now it does not work, the content is not scrollable and gets hidden
 */

import { effect } from "@preact/signals";
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
      <div className="explorer_body">
        <ChildrenWithResizeHandle>
          <ExplorerDatabases id="databases_explorer" />
          <ExplorerRoles id="roles_explorer" />
        </ChildrenWithResizeHandle>
      </div>
    </nav>
  );
};

const ChildrenWithResizeHandle = ({ children }) => {
  if (!Array.isArray(children)) {
    return children;
  }
  const elements = [];
  let i = 0;
  while (i < children.length) {
    const child = children[i];
    elements.push(child);
    i++;
    if (i > 0 && i < children.length) {
      elements.push(
        <div data-resize-handle={child.props.id}>
          <div></div>
        </div>,
      );
    }
  }

  return elements;
};
