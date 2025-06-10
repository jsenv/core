import { TextAndCount } from "../components/text_and_count.jsx";
import {
  createExplorerGroupController,
  ExplorerGroup,
} from "../explorer/explorer_group.jsx";
import { DATABASES_DETAILS_ROUTE } from "./database_details_routes.js";
import { DatabaseWithPlusSvg } from "./database_icons.jsx";
import { DatabaseLink } from "./database_link.jsx";
import {
  DELETE_DATABASE_ACTION,
  POST_DATABASE_ACTION,
  PUT_DATABASE_ACTION,
} from "./database_routes.js";
import { useDatabaseCount, useDatabaseList } from "./database_signals.js";

export const databasesDetailsController =
  createExplorerGroupController("databases");

export const DatabasesDetails = (props) => {
  const databases = useDatabaseList();
  const databaseCount = useDatabaseCount();

  return (
    <ExplorerGroup
      {...props}
      controller={databasesDetailsController}
      detailsRoute={DATABASES_DETAILS_ROUTE}
      idKey="oid"
      nameKey="datname"
      labelChildren={<TextAndCount text={"DATABASES"} count={databaseCount} />}
      renderNewButtonChildren={() => <DatabaseWithPlusSvg />}
      renderItem={(item, props) => (
        <DatabaseLink key={item.oid} database={item} {...props} />
      )}
      useItemList={useDatabaseList}
      useRenameItemAction={(database) =>
        PUT_DATABASE_ACTION.bindParams({
          datname: database.datname,
          columnName: "datname",
        })
      }
      useCreateItemAction={() => POST_DATABASE_ACTION}
      useDeleteItemAction={(database) =>
        DELETE_DATABASE_ACTION.bindParams({
          datname: database.datname,
        })
      }
    >
      {databases}
    </ExplorerGroup>
  );
};
