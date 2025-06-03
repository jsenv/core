import { useAction, useRouteIsMatching } from "@jsenv/router";
import { useCallback } from "preact/hooks";
import { UserWithPlusSvg } from "../role/role_icons.jsx";
import { RoleLink } from "../role/role_link.jsx";
import {
  DELETE_ROLE_ACTION,
  GET_ROLE_ROUTE,
  POST_ROLE_ACTION,
  PUT_ROLE_ACTION,
} from "../role/role_routes.js";
import { useRoleList } from "../role/role_signals.js";
import {
  createExplorerGroupController,
  ExplorerGroup,
} from "./explorer_group.jsx";
import { EXPLORER_ROLES_ROUTE } from "./explorer_routes.js";

export const rolesExplorerGroupController =
  createExplorerGroupController("roles");

export const ExplorerRoles = (props) => {
  const roles = useRoleList();

  return (
    <ExplorerGroup
      {...props}
      controller={rolesExplorerGroupController}
      detailsRoute={EXPLORER_ROLES_ROUTE}
      idKey="oid"
      nameKey="rolname"
      labelChildren={
        <span style="display: flex; align-items: center; gap: 3px">
          ROLES
          <span style="color: rgba(28, 43, 52, 0.4)">({roles.length})</span>
        </span>
      }
      createNewButtonChildren={<UserWithPlusSvg />}
      renderItem={useCallback(
        (item, props) => (
          <RoleLink role={item} {...props} />
        ),
        [],
      )}
      useItemList={useRoleList}
      useItemRouteIsActive={(role) =>
        useRouteIsMatching(GET_ROLE_ROUTE, {
          rolname: role.rolname,
        })
      }
      useRenameItemAction={(role) =>
        useAction(PUT_ROLE_ACTION, {
          rolname: role.rolname,
          columnName: "rolname",
        })
      }
      useCreateItemAction={() => useAction(POST_ROLE_ACTION)}
      useDeleteItemAction={(role) =>
        useAction(DELETE_ROLE_ACTION, {
          rolname: role.rolname,
        })
      }
    >
      {roles}
    </ExplorerGroup>
  );
};
