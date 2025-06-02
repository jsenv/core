import { useAction, useRouteIsMatching, useRouteUrl } from "@jsenv/router";
import { useCallback } from "preact/hooks";
import { UserWithPlusSvg } from "../role/role_icons.jsx";
import { RoleItem } from "../role/role_item.jsx";
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

export const rolesExplorerGroupController =
  createExplorerGroupController("roles");

export const ExplorerRoles = (props) => {
  const roles = useRoleList();

  return (
    <ExplorerGroup
      {...props}
      controller={rolesExplorerGroupController}
      urlParam="roles"
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
        (item) => (
          <RoleItem role={item} />
        ),
        [],
      )}
      useItemList={useRoleList}
      useItemRouteUrl={(role) =>
        useRouteUrl(GET_ROLE_ROUTE, {
          rolname: role.rolname,
        })
      }
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
