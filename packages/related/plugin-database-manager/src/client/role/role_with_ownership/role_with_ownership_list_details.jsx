import { Route } from "@jsenv/router";
import { TextAndCount } from "../../components/text_and_count.jsx";
import { ExplorerDetails } from "../../explorer/explorer_details.jsx";
import {
  createExplorerGroupController,
  ExplorerGroup,
} from "../../explorer/explorer_group.jsx";
import { ExplorerItemList } from "../../explorer/explorer_item_list.jsx";
import { TableLink } from "../../table/table_link.jsx";
import { useRoleList, useRoleTables } from "../role_signals.js";
import { ROLE_WITH_OWNERSHIP_LIST_DETAILS_ROUTE } from "./role_with_ownership_list_details_routes.js";
import { getRoleTableListDetailsRoute } from "./role_with_ownership_routes.js";
import {
  useRoleWithOwnershipCount,
  useRoleWithOwnershipList,
} from "./role_with_ownership_signals.js";

export const roleWithOwnershipListDetailsController =
  createExplorerGroupController("role_with_ownership_list");

export const RoleWithOwnershipListDetails = (props) => {
  const roleWithOwnershipCount = useRoleWithOwnershipCount();
  const roleWithOwnershipList = useRoleWithOwnershipList();

  return (
    <ExplorerGroup
      {...props}
      controller={roleWithOwnershipListDetailsController}
      detailsRoute={ROLE_WITH_OWNERSHIP_LIST_DETAILS_ROUTE}
      idKey="oid"
      nameKey="rolname"
      labelChildren={
        <TextAndCount
          text={"ROLE WITH OWNERSHIP"}
          count={roleWithOwnershipCount}
        />
      }
      renderItem={(role, { children, ...props }) => {
        return (
          <ExplorerDetails
            id={`role_ownership_details_${role.oid}`}
            item={role}
            label={<TextAndCount text={children} count={role.object_count} />}
            {...props}
          >
            <ExplorerItemList
              idKey="id"
              nameKey="name"
              renderItem={(subitem) => {
                if (subitem.id === "tables") {
                  return (
                    <Route.Details
                      route={getRoleTableListDetailsRoute(role)}
                      renderLoaded={() => {
                        const tables = useRoleTables(role);
                        return (
                          <ExplorerItemList
                            renderItem={(table) => (
                              <TableLink table={table}>
                                {table.tablename}
                              </TableLink>
                            )}
                          >
                            {tables}
                          </ExplorerItemList>
                        );
                      }}
                    >
                      <TextAndCount text="tables" count={role.table_count} />
                    </Route.Details>
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
                return null;
              }}
            >
              {[
                ...(role.database_count > 0
                  ? [
                      {
                        id: "databases",
                        name: "databases",
                        item: role,
                      },
                    ]
                  : []),
                ...(role.table_count > 0
                  ? [
                      {
                        id: "tables",
                        name: "tables",
                        item: role,
                      },
                    ]
                  : []),
              ]}
            </ExplorerItemList>
          </ExplorerDetails>
        );
      }}
      useItemList={useRoleList}
    >
      {roleWithOwnershipList}
    </ExplorerGroup>
  );
};
