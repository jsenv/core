import { TextAndCount } from "../components/text_and_count.jsx";
import { ExplorerDetails } from "../explorer/explorer_details.jsx";
import {
  createExplorerGroupController,
  ExplorerGroup,
} from "../explorer/explorer_group.jsx";
import { ExplorerItemList } from "../explorer/explorer_item_list.jsx";
import { EXPLORER_OWNERS_ROUTE } from "../explorer/explorer_routes.js";
import { useRoleList } from "./role_signals.js";

export const ownersExplorerGroupController =
  createExplorerGroupController("owners");

export const ExplorerOwnership = (props) => {
  const roles = useRoleList();

  return (
    <ExplorerGroup
      {...props}
      controller={ownersExplorerGroupController}
      detailsRoute={EXPLORER_OWNERS_ROUTE}
      idKey="oid"
      nameKey="rolname"
      labelChildren={<TextAndCount text={"OWNERSHIP OVERVIEW"} count={0} />}
      renderItem={(role, { children, ...props }) => {
        if (role.object_count === 0) {
          return null;
        }
        return (
          <ExplorerDetails
            id={`role_details_${role.oid}`}
            item={role}
            label={<TextAndCount text={children} count={role.object_count} />}
            {...props}
          >
            <ExplorerItemList
              idKey="id"
              nameKey="name"
              renderItem={(subitem) => {
                if (subitem.id === "tables") {
                  if (role.table_count === 0) {
                    return null;
                  }
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
                  if (role.database_count === 0) {
                    return null;
                  }
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
              ]}
            </ExplorerItemList>
          </ExplorerDetails>
        );
      }}
      useItemList={useRoleList}
    >
      {roles}
    </ExplorerGroup>
  );
};
