import { Route } from "@jsenv/router";
import { TextAndCount } from "../../components/text_and_count.jsx";
import { DatabaseLink } from "../../database/database_link.jsx";
import { ExplorerDetails } from "../../explorer/explorer_details.jsx";
import {
  createExplorerGroupController,
  ExplorerGroup,
} from "../../explorer/explorer_group.jsx";
import { ExplorerItemList } from "../../explorer/explorer_item_list.jsx";
import { TableLink } from "../../table/table_link.jsx";
import {
  useRoleDatabases,
  useRoleList,
  useRoleTables,
} from "../role_signals.js";
import { ROLE_WITH_OWNERSHIP_LIST_DETAILS_ROUTE } from "./role_with_ownership_list_details_routes.js";
import {
  getRoleDatabaseListDetailsRoute,
  getRoleTableListDetailsRoute,
} from "./role_with_ownership_routes.js";
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
      renderItem={(role, { children }) => {
        return (
          <ExplorerDetails
            id={`role_${role.rolname}_ownership_details`}
            label={<TextAndCount text={children} count={role.object_count} />}
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
                    <Route.Details
                      route={getRoleDatabaseListDetailsRoute(role)}
                      renderLoaded={() => {
                        const databaseList = useRoleDatabases(role);
                        return (
                          <ExplorerItemList
                            renderItem={(database) => (
                              <DatabaseLink database={database}>
                                {database.datname}
                              </DatabaseLink>
                            )}
                          >
                            {databaseList}
                          </ExplorerItemList>
                        );
                      }}
                    >
                      <TextAndCount
                        text="databases"
                        count={role.database_count}
                      />
                    </Route.Details>
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
