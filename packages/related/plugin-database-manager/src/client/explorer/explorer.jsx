import { initFlexDetailsSet } from "@jsenv/dom";
import { FontSizedSvg, useRunOnMount } from "@jsenv/navi";
import { useLayoutEffect, useRef, useState } from "preact/hooks";
// import { DatabaseSvg } from "../database/database_icons.jsx";
// import { useCurrentDatabase } from "../database/database_signals.js";
import {
  DatabasesDetails,
  databasesDetailsController,
} from "../database/databases_details.jsx";
import {
  RoleCanLoginListDetails,
  roleCanLoginListDetailsController,
} from "../role/role_can_login/role_can_login_list_details.jsx";
import {
  RoleGroupListDetails,
  roleGroupListDetailsController,
} from "../role/role_group/role_group_list_details.jsx";
import { pickRoleIcon } from "../role/role_icons.jsx";
import { useCurrentRole } from "../role/role_store.js";
import {
  RoleWithOwnershipListDetails,
  roleWithOwnershipListDetailsController,
} from "../role/role_with_ownership/role_with_ownership_list_details.jsx";
import {
  TablesDetails,
  tablesDetailsController,
} from "../table/tables_details.jsx";
import "./explorer.css" with { type: "css" };
import "./explorer_store.js";
import { EXPLORER } from "./explorer_store.js";

export const Explorer = () => {
  useRunOnMount(EXPLORER.GET, Explorer);

  const role = useCurrentRole();
  // const database = useCurrentDatabase();
  const RoleIcon = pickRoleIcon(role);

  return (
    <nav className="explorer">
      <div className="explorer_head">
        <FontSizedSvg>
          <RoleIcon />
        </FontSizedSvg>
        <select style="margin-top: 10px; margin-bottom: 10px; margin-left: 5px;">
          <option selected>{role.rolname}</option>
        </select>
        <span style="width: 10px"></span>
        {/* <FontSizedSvg>
          <DatabaseSvg />
        </FontSizedSvg>
        <select style="margin-top: 10px; margin-bottom: 10px; margin-left: 5px;">
          <option selected>{database.datname}</option>
        </select> */}
      </div>
      <ExplorerBody />
      <div className="explorer_foot"></div>
    </nav>
  );
};

const ExplorerBody = () => {
  const flexDetailsSetRef = useRef();
  const [resizableDetailsIdSet, setResizableDetailsIdSet] = useState(new Set());
  useLayoutEffect(() => {
    const flexDetailsSet = initFlexDetailsSet(flexDetailsSetRef.current, {
      onResizableDetailsChange: (resizableDetailsIdSet) => {
        setResizableDetailsIdSet(new Set(resizableDetailsIdSet));
      },
      onRequestedSizeChange: (element, requestedHeight) => {
        if (element.id === tablesDetailsController.id) {
          tablesDetailsController.setHeightSetting(requestedHeight);
        }
        if (element.id === databasesDetailsController.id) {
          databasesDetailsController.setHeightSetting(requestedHeight);
        }
        if (element.id === roleCanLoginListDetailsController.id) {
          roleCanLoginListDetailsController.setHeightSetting(requestedHeight);
        }
        if (element.id === roleGroupListDetailsController.id) {
          roleGroupListDetailsController.setHeightSetting(requestedHeight);
        }
        if (element.id === roleWithOwnershipListDetailsController.id) {
          roleWithOwnershipListDetailsController.setHeightSetting(
            requestedHeight,
          );
        }
      },
    });
    return flexDetailsSet.cleanup;
  }, []);

  return (
    <div ref={flexDetailsSetRef} className="explorer_body">
      <RoleCanLoginListDetails
        resizable={resizableDetailsIdSet.has(
          roleCanLoginListDetailsController.id,
        )}
      />
      <RoleGroupListDetails
        resizable={resizableDetailsIdSet.has(roleGroupListDetailsController.id)}
      />
      <DatabasesDetails
        resizable={resizableDetailsIdSet.has(databasesDetailsController.id)}
      />
      <TablesDetails
        resizable={resizableDetailsIdSet.has(tablesDetailsController.id)}
      />
      <RoleWithOwnershipListDetails
        resizable={resizableDetailsIdSet.has(
          roleWithOwnershipListDetailsController.id,
        )}
      />
    </div>
  );
};
