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
import { ExplorerDetails } from "../explorer_details.jsx";
import {
  createExplorerGroupController,
  ExplorerGroup,
} from "../explorer_group.jsx";
import { ExplorerItemList } from "../explorer_item_list.jsx";
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
      createNewButtonChildren={<UserWithPlusSvg />}
      renderItem={(role, { children, ...props }) => (
        <ExplorerDetails
          id={`role_details_${role.oid}`}
          item={role}
          label={children}
          {...props}
        >
          <ExplorerItemList
            idKey="id"
            nameKey="name"
            renderItem={(subitem) => {
              if (subitem.id === "tables") {
                return (
                  <ExplorerDetails
                    label={
                      <TextAndCount text="tables" count={role.table_count} />
                    }
                  >
                    Coucou
                  </ExplorerDetails>
                );
              }
              if (subitem.id === "databases") {
                return (
                  <ExplorerDetails
                    label={
                      <TextAndCount
                        text="databases"
                        count={role.database_count}
                      />
                    }
                  >
                    Coucou
                  </ExplorerDetails>
                );
              }
              // need a link to the details role
              return <RoleLink role={role}>{role.rolname}</RoleLink>;
            }}
          >
            {[
              {
                id: "databases",
                name: "databases",
                item: role,
              },
              {
                id: "tables",
                name: `tables`,
                item: role,
              },
              {
                id: "props",
                name: `props`,
                item: role,
              },
            ]}
          </ExplorerItemList>
        </ExplorerDetails>
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
