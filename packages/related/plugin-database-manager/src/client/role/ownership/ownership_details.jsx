import { TextAndCount } from "../../components/text_and_count.jsx";
import { ExplorerDetails } from "../../explorer/explorer_details.jsx";
import {
  createExplorerGroupController,
  ExplorerGroup,
} from "../../explorer/explorer_group.jsx";
import { ExplorerItemList } from "../../explorer/explorer_item_list.jsx";
import { useOwnerList } from "../role_signals.js";
import { OWNERSHIP_DETAILS_ROUTE } from "./ownership_details_routes.js";

export const ownersExplorerGroupController =
  createExplorerGroupController("owners");

export const OwnershipDetails = (props) => {
  const owners = useOwnerList();

  return (
    <ExplorerGroup
      {...props}
      controller={ownersExplorerGroupController}
      detailsRoute={OWNERSHIP_DETAILS_ROUTE}
      idKey="oid"
      nameKey="rolname"
      labelChildren={<TextAndCount text={"OWNERSHIP OVERVIEW"} count={0} />}
      renderItem={(role, { children, ...props }) => {
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
      useItemList={useOwnerList}
    >
      {owners}
    </ExplorerGroup>
  );
};
