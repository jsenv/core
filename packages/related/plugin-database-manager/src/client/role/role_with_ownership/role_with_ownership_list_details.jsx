import { Details } from "@jsenv/navi";
import { TextAndCount } from "../../components/text_and_count.jsx";
import { DatabaseLink } from "../../database/database_link.jsx";
import { useRoleWithOwnershipCount } from "../../database_signals.js";
import { ExplorerDetails } from "../../explorer/explorer_details.jsx";
import {
  createExplorerGroupController,
  ExplorerGroup,
} from "../../explorer/explorer_group.jsx";
import { ExplorerItemList } from "../../explorer/explorer_item_list.jsx";
import { ROLE_DATABASES, ROLE_TABLES } from "../../store.js";
import { TableLink } from "../../table/table_link.jsx";
import {
  ROLE_WITH_OWNERSHIP,
  useRoleArrayInStore,
  useRoleWithOwnershipArray,
} from "../role_store.js";
import {
  roleWithOwnershipListDetailsOnToggle,
  roleWithOwnershipListDetailsOpenAtStart,
} from "./role_with_ownership_list_details_state.js";

export const roleWithOwnershipListDetailsController =
  createExplorerGroupController("role_with_ownership_list", {
    detailsOpenAtStart: roleWithOwnershipListDetailsOpenAtStart,
    detailsOnToggle: roleWithOwnershipListDetailsOnToggle,
  });

export const RoleWithOwnershipListDetails = (props) => {
  const roleWithOwnershipCount = useRoleWithOwnershipCount();
  const roleWithOwnershipArray = useRoleWithOwnershipArray();

  return (
    <ExplorerGroup
      {...props}
      controller={roleWithOwnershipListDetailsController}
      detailsAction={ROLE_WITH_OWNERSHIP.GET_MANY}
      idKey="oid"
      nameKey="rolname"
      labelChildren={
        <TextAndCount text={"OWNERSHIP"} count={roleWithOwnershipCount} />
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
                    <Details
                      action={ROLE_TABLES.GET_MANY.bindParams({
                        rolname: role.rolname,
                      })}
                      renderLoaded={(tableArray) => {
                        return (
                          <ExplorerItemList
                            renderItem={(table) => (
                              <TableLink table={table}>
                                {table.tablename}
                              </TableLink>
                            )}
                          >
                            {tableArray}
                          </ExplorerItemList>
                        );
                      }}
                    >
                      <TextAndCount text="tables" count={role.table_count} />
                    </Details>
                  );
                }
                if (subitem.id === "databases") {
                  return (
                    <Details
                      action={ROLE_DATABASES.GET_MANY.bindParams({
                        rolname: role.rolname,
                      })}
                      actionRenderer={(databaseArray) => {
                        return (
                          <ExplorerItemList
                            renderItem={(database) => (
                              <DatabaseLink database={database}>
                                {database.datname}
                              </DatabaseLink>
                            )}
                          >
                            {databaseArray}
                          </ExplorerItemList>
                        );
                      }}
                    >
                      <TextAndCount
                        text="databases"
                        count={role.database_count}
                      />
                    </Details>
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
      useItemArrayInStore={useRoleArrayInStore}
    >
      {roleWithOwnershipArray}
    </ExplorerGroup>
  );
};
