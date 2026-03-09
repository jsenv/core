import { useState } from "preact/hooks";

import { useDatabaseCount } from "../database_manager_signals.js";
import { ExplorerGroup } from "../explorer/explorer_group.jsx";
import { DATABASE_GET_MANY_ACTION } from "../routes.js";
import { DatabaseWithPlusSvg } from "./database_icons.jsx";
import { DatabaseLink } from "./database_link.jsx";
import { databaseHeightSignal, databaseOpenSignal } from "./database_state.js";
import { DATABASE, useDatabaseArrayInStore } from "./database_store.js";

export const DatabasesDetails = () => {
  const [resizable, setResizable] = useState(false);
  const databaseCount = useDatabaseCount();

  return (
    <ExplorerGroup
      id="database_list"
      open={databaseOpenSignal.value}
      detailsConnectedAction={DATABASE_GET_MANY_ACTION}
      detailsUIAction={(open) => {
        databaseOpenSignal.value = open;
      }}
      resizable={resizable}
      height={databaseHeightSignal.value}
      onresizeend={(e) => {
        const newHeight = e.detail.size;
        databaseHeightSignal.value = newHeight;
      }}
      onresizablechange={(e) => {
        setResizable(e.detail.resizable);
      }}
      idKey="oid"
      nameKey="datname"
      label="DATABASES"
      count={databaseCount}
      renderNewButtonChildren={() => <DatabaseWithPlusSvg />}
      renderItem={(database, props) => (
        <DatabaseLink
          draggable={false}
          key={database.oid}
          value={database.datname}
          database={database}
          {...props}
        />
      )}
      useItemArrayInStore={useDatabaseArrayInStore}
      createItemAction={(datname) =>
        DATABASE.POST({
          datname,
        })
      }
      deleteItemAction={(database) =>
        DATABASE.DELETE({
          datname: database.datname,
        })
      }
      renameItemAction={(database, newDatname) =>
        DATABASE.PUT({
          datname: database.datname,
          columnName: "datname",
          columnValue: newDatname,
        })
      }
    />
  );
};
