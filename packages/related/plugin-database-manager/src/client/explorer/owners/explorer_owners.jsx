import { TextAndCount } from "../../components/text_and_count.jsx";
import { useRoleList } from "../../role/role_signals.js";
import { ExplorerDetails } from "../explorer_details.jsx";
import {
  createExplorerGroupController,
  ExplorerGroup,
} from "../explorer_group.jsx";
import { ExplorerItemList } from "../explorer_item_list.jsx";
import { EXPLORER_OWNERS_ROUTE } from "../explorer_routes.js";

export const ownersExplorerGroupController =
  createExplorerGroupController("owners");

export const ExplorerOwners = (props) => {
  const roles = useRoleList();

  return (
    <ExplorerGroup
      {...props}
      controller={ownersExplorerGroupController}
      detailsRoute={EXPLORER_OWNERS_ROUTE}
      idKey="oid"
      nameKey="rolname"
      labelChildren={<TextAndCount text={"OWNERS"} count={0} />}
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
