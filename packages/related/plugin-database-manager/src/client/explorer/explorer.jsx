/**
 * - escape should cancel role creation
 * - a custon validity message when role name already exists
 * - ability to rename by enter
 * - cmd + backspace would allow to delete a role (after a confirm)
 */

import { effect } from "@preact/signals";
import { useState, useCallback } from "preact/hooks";
import {
  useDetails,
  SPALink,
  SPAInputText,
  useRouteIsMatching,
  useAction,
} from "@jsenv/router";
import {
  UserWithHatSvg,
  UserSvg,
  UserWithCheckSvg,
  UserWithPlusSvg,
} from "../user_svgs.jsx";
import {
  GET_ROLE_ROUTE,
  POST_ROLE_ACTION,
  DELETE_ROLE_ACTION,
} from "../role/role_routes.js";
import { roleStore } from "../role/role_store.js";
import {
  setCurrentRole,
  useCurrentRole,
  useRoleList,
} from "../role/role_signals.js";
import "./explorer.css" with { type: "css" };

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
      <ExplorerGroupRoles />
    </nav>
  );
};

const ExplorerGroupRoles = () => {
  const roles = useRoleList();
  // roles.sort((a, b) => {
  //   const aIsPg = a.rolname.startsWith("pg_");
  //   const bIsPg = b.rolname.startsWith("pg_");
  //   if (aIsPg && !bIsPg) {
  //     return 1;
  //   }
  //   if (bIsPg && !aIsPg) {
  //     return -1;
  //   }
  //   return 0;
  // });
  const items = roles.map((role) => {
    return <ExplorerGroupItemRole key={role.rolname} role={role} />;
  });

  const [isCreatingNew, setIsCreatingNew] = useState(false);
  const startCreatingNew = useCallback(() => {
    setIsCreatingNew(true);
  }, [setIsCreatingNew]);
  const stopCreatingNew = useCallback(() => {
    setIsCreatingNew(false);
  }, [setIsCreatingNew]);

  return (
    <ExplorerGroup
      urlParam="roles"
      label={
        <span className="summary_label">
          ROLES
          <span style="display: flex; flex: 1"></span>
          <button
            className="summary_action_icon"
            style="width: 22px; height: 22px; cursor: pointer;"
            onMouseDown={(e) => {
              // ensure when input is focused it stays focused
              // without this preventDefault() the input would be blurred (which might cause creation of an item) and re-opened empty
              e.preventDefault();
            }}
            onClick={(e) => {
              e.preventDefault();
              startCreatingNew();
            }}
          >
            <UserWithPlusSvg />
          </button>
        </span>
      }
    >
      <ul className="explorer_group_list">
        {items.map((item) => {
          return <ExplorerGroupItem key={item.url}>{item}</ExplorerGroupItem>;
        })}
        {isCreatingNew && (
          <NewItem
            onCancel={() => {
              // si on a rien rentré on le cré pas, sinon oui on le cré
              stopCreatingNew();
            }}
            onActionSuccess={() => {
              stopCreatingNew();
            }}
          />
        )}
      </ul>
    </ExplorerGroup>
  );
};

const ExplorerGroupItemRole = ({ role }) => {
  const currentRole = useCurrentRole();
  const rolname = role.rolname;
  const isCurrent = rolname === currentRole?.rolname;
  const isOpened = useRouteIsMatching(GET_ROLE_ROUTE, { rolname });
  const deleteAction = useAction(DELETE_ROLE_ACTION, { rolname });

  return (
    <SPALink
      key={rolname}
      route={GET_ROLE_ROUTE}
      routeParams={{ rolname }}
      className="explorer_group_item_content"
      deleteShortcutAction={deleteAction}
      deleteShortcutConfirmContent={`Are you sure you want to delete the role "${rolname}"?`}
    >
      <span style="width: 1em; height: 1em">
        {rolname.startsWith("pg_") ? (
          <UserWithCheckSvg color="#333" />
        ) : role.rolsuper ? (
          <UserWithHatSvg color="#333" />
        ) : (
          <UserSvg color="#333" />
        )}
      </span>
      {isCurrent ? (
        <span style="width: 1em; height: 1em">
          <ActiveUserSvg />
        </span>
      ) : null}
      <span
        style={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          background: isOpened ? "lightgrey" : "none",
        }}
      >
        {rolname}
      </span>
    </SPALink>
  );
};

const ExplorerGroupItem = ({ children }) => {
  return <li className="explorer_group_item">{children}</li>;
};

const NewItem = ({ onCancel, onActionSuccess }) => {
  // il faudrait un spa input text, celui ci se brancherait sur le onchange/enter
  // donc comme les autres, juste il aura autofocus
  // aussi il faut donc lui passer la route, pendant qu'on crée il est disabled
  // il faudrait vérif que le nom n'existe pas déja
  // on fera avec customValidity (vérif que ca marche avec requestSubmit dailleurs)
  // dailleurs on pourrait ptet faire ¸a aussi pour les erreurs serveurs

  return (
    <ExplorerGroupItem>
      <span className="explorer_group_item_content">
        <span style="display: flex; width: 1em; height: 1em">
          <EnterNameIconSvg />
        </span>
        <SPAInputText
          name="rolname"
          autoFocus
          required
          action={useAction(POST_ROLE_ACTION)}
          onKeydown={(e) => {
            if (e.key === "Escape") {
              onCancel();
            }
          }}
          onBlur={(e) => {
            const value = e.target.value;
            if (value.trim() === "") {
              onCancel();
            }
          }}
          onActionSuccess={onActionSuccess}
        />
      </span>
    </ExplorerGroupItem>
  );
};

const ExplorerGroup = ({ urlParam, label, children }) => {
  const detailsProps = useDetails(urlParam);

  return (
    <details {...detailsProps}>
      <summary>
        <span className="summary_marker" style="width: 24px; height: 24px">
          <ArrowDown />
        </span>
        {label}
      </summary>
      <div className="explorer_group_content">{children}</div>
    </details>
  );
};

const ActiveUserSvg = () => {
  return (
    <svg
      viewBox="0 0 16 16"
      width="100%"
      height="100%"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="m 8 0 c -3.3125 0 -6 2.6875 -6 6 c 0.007812 0.710938 0.136719 1.414062 0.386719 2.078125 l -0.015625 -0.003906 c 0.636718 1.988281 3.78125 5.082031 5.625 6.929687 h 0.003906 v -0.003906 c 1.507812 -1.507812 3.878906 -3.925781 5.046875 -5.753906 c 0.261719 -0.414063 0.46875 -0.808594 0.585937 -1.171875 l -0.019531 0.003906 c 0.25 -0.664063 0.382813 -1.367187 0.386719 -2.078125 c 0 -3.3125 -2.683594 -6 -6 -6 z m 0 3.691406 c 1.273438 0 2.308594 1.035156 2.308594 2.308594 s -1.035156 2.308594 -2.308594 2.308594 c -1.273438 -0.003906 -2.304688 -1.035156 -2.304688 -2.308594 c -0.003906 -1.273438 1.03125 -2.304688 2.304688 -2.308594 z m 0 0"
        fill="#2e3436"
      />
    </svg>
  );
};

const EnterNameIconSvg = ({ color = "currentColor" }) => {
  return (
    <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M21.1213 2.70705C19.9497 1.53548 18.0503 1.53547 16.8787 2.70705L15.1989 4.38685L7.29289 12.2928C7.16473 12.421 7.07382 12.5816 7.02986 12.7574L6.02986 16.7574C5.94466 17.0982 6.04451 17.4587 6.29289 17.707C6.54127 17.9554 6.90176 18.0553 7.24254 17.9701L11.2425 16.9701C11.4184 16.9261 11.5789 16.8352 11.7071 16.707L19.5556 8.85857L21.2929 7.12126C22.4645 5.94969 22.4645 4.05019 21.2929 2.87862L21.1213 2.70705ZM18.2929 4.12126C18.6834 3.73074 19.3166 3.73074 19.7071 4.12126L19.8787 4.29283C20.2692 4.68336 20.2692 5.31653 19.8787 5.70705L18.8622 6.72357L17.3068 5.10738L18.2929 4.12126ZM15.8923 6.52185L17.4477 8.13804L10.4888 15.097L8.37437 15.6256L8.90296 13.5112L15.8923 6.52185ZM4 7.99994C4 7.44766 4.44772 6.99994 5 6.99994H10C10.5523 6.99994 11 6.55223 11 5.99994C11 5.44766 10.5523 4.99994 10 4.99994H5C3.34315 4.99994 2 6.34309 2 7.99994V18.9999C2 20.6568 3.34315 21.9999 5 21.9999H16C17.6569 21.9999 19 20.6568 19 18.9999V13.9999C19 13.4477 18.5523 12.9999 18 12.9999C17.4477 12.9999 17 13.4477 17 13.9999V18.9999C17 19.5522 16.5523 19.9999 16 19.9999H5C4.44772 19.9999 4 19.5522 4 18.9999V7.99994Z"
        fill={color}
      />
    </svg>
  );
};

const ArrowDown = () => {
  return (
    <svg
      viewBox="0 -960 960 960"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M480-345 240-585l56-56 184 184 184-184 56 56-240 240Z" />
    </svg>
  );
};
