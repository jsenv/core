import { useRouteIsMatching } from "@jsenv/router";
import { TextAndCount } from "../../components/text_and_count.jsx";
import { UserWithPlusSvg } from "../../role/role_icons.jsx";
import { RoleLink } from "../../role/role_link.jsx";
import {
  DELETE_ROLE_ACTION,
  GET_ROLE_ROUTE,
  POST_ROLE_ACTION,
  PUT_ROLE_ACTION,
} from "../../role/role_routes.js";
import { useRoleCount, useRoleList } from "../../role/role_signals.js";
import {
  createExplorerGroupController,
  ExplorerGroup,
} from "../explorer_group.jsx";
import { EXPLORER_ROLES_ROUTE } from "../explorer_routes.js";

export const rolesExplorerGroupController =
  createExplorerGroupController("roles");

export const ExplorerRoles = (props) => {
  const roles = useRoleList();
  const roleCount = useRoleCount();

  return (
    <ExplorerGroup
      {...props}
      controller={rolesExplorerGroupController}
      detailsRoute={EXPLORER_ROLES_ROUTE}
      idKey="oid"
      nameKey="rolname"
      labelChildren={<TextAndCount text={"ROLES"} count={roleCount} />}
      renderNewButtonChildren={() => <UserWithPlusSvg />}
      renderItem={(role, { children, ...props }) => (
        <RoleLink role={role} {...props}>
          {children}
        </RoleLink>
      )}
      useItemList={useRoleList}
      useItemRouteIsActive={(role) =>
        useRouteIsMatching(GET_ROLE_ROUTE, {
          rolname: role.rolname,
        })
      }
      useRenameItemAction={(role) =>
        PUT_ROLE_ACTION.bindParams({
          rolname: role.rolname,
          columnName: "rolname",
        })
      }
      useCreateItemAction={() => POST_ROLE_ACTION}
      useDeleteItemAction={(role) =>
        DELETE_ROLE_ACTION.bindParams({
          rolname: role.rolname,
        })
      }
    >
      {roles}
    </ExplorerGroup>
  );
};
