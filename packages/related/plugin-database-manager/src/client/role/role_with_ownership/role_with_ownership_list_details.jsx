import { Details } from "@jsenv/navi";
import { DatabaseLink } from "../../database/database_link.jsx";
import { useRoleWithOwnershipCount } from "../../database_manager_signals.js";
import {
  createExplorerGroupController,
  ExplorerGroup,
} from "../../explorer/explorer_group.jsx";
import { ExplorerItemList } from "../../explorer/explorer_item_list.jsx";
import {
  ROLE_DATABASES,
  ROLE_TABLES,
  ROLE_WITH_OWNERSHIP,
  useRoleWithOwnershipArray,
} from "../../store.js";
import { TableLink } from "../../table/table_link.jsx";
import { pickRoleIcon } from "../role_icons.jsx";
import { useRoleArrayInStore } from "../role_store.js";
import {
  roleWithOwnershipListDetailsOnToggle,
  roleWithOwnershipListDetailsOpenAtStart,
} from "./role_with_ownership_list_details_state.js";

const IconAndText = (props) => props;
const TextAndCount = (props) => props;

import.meta.css = /* css */ `
  .explorer_details {
    flex: 1;
  }

  .explorer_details summary {
    padding-left: calc(16px + var(--details-depth, 0) * 16px);
  }

  .explorer_details .explorer_item_content {
    padding-left: calc(32px + var(--details-depth, 0) * 16px);
  }
`;

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
      renderItem={(role) => {
        return (
          <Details
            id={`role_${role.rolname}_ownership_details`}
            className="explorer_details"
            style={{ "--details-depth": 0 }}
            label={
              <TextAndCount
                text={
                  <IconAndText icon={pickRoleIcon(role)}>
                    {role.rolname}
                  </IconAndText>
                }
                count={role.object_count}
              />
            }
          >
            <ExplorerItemList
              idKey="id"
              nameKey="name"
              itemArray={[
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
              renderItem={(subitem) => {
                if (subitem.id === "tables") {
                  return (
                    <Details
                      id={`role_${role.rolname}_tables_details`}
                      className="explorer_details"
                      style={{ "--details-depth": 1 }}
                      action={ROLE_TABLES.GET_MANY.bindParams({
                        rolname: role.rolname,
                      })}
                      label={
                        <TextAndCount text="tables" count={role.table_count} />
                      }
                    >
                      {(tableArray) => {
                        return (
                          <ExplorerItemList
                            itemArray={tableArray}
                            renderItem={(table) => (
                              <TableLink
                                className="explorer_item_content"
                                table={table}
                              >
                                {table.tablename}
                              </TableLink>
                            )}
                          />
                        );
                      }}
                    </Details>
                  );
                }
                if (subitem.id === "databases") {
                  return (
                    <Details
                      id={`role_${role.rolname}_databases_details`}
                      className="explorer_details"
                      style={{ "--details-depth": 1 }}
                      label={
                        <TextAndCount
                          text="databases"
                          count={role.database_count}
                        />
                      }
                      action={ROLE_DATABASES.GET_MANY.bindParams({
                        rolname: role.rolname,
                      })}
                    >
                      {(databaseArray) => {
                        return (
                          <ExplorerItemList
                            itemArray={databaseArray}
                            renderItem={(database) => (
                              <DatabaseLink
                                className="explorer_item_content"
                                database={database}
                              >
                                {database.datname}
                              </DatabaseLink>
                            )}
                          />
                        );
                      }}
                    </Details>
                  );
                }
                return null;
              }}
            ></ExplorerItemList>
          </Details>
        );
      }}
      useItemArrayInStore={useRoleArrayInStore}
    >
      {roleWithOwnershipArray}
    </ExplorerGroup>
  );
};
