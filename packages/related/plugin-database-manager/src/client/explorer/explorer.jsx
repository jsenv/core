import { initFlexDetailsSet } from "@jsenv/dom";
import { useLayoutEffect, useRef, useState } from "preact/hooks";
import { DatabaseSvg } from "../database/database_icons.jsx";
import { useCurrentDatabase } from "../database/database_signals.js";
import {
  DatabasesDetails,
  databasesDetailsController,
} from "../database/databases_details.jsx";
import {
  GroupsDetails,
  groupsDetailsController,
} from "../role/group/groups_details.jsx";
import {
  OwnershipDetails,
  ownershipDetailsController,
} from "../role/ownership/ownership_details.jsx";
import { pickRoleIcon } from "../role/role_icons.jsx";
import { useCurrentRole } from "../role/role_signals.js";
import {
  UsersDetails,
  usersDetailsController,
} from "../role/user/users_details.jsx";
import { FontSizedSvg } from "../svg/font_sized_svg.jsx";
import {
  TablesDetails,
  tablesDetailsController,
} from "../table/tables_details.jsx";
import "./explorer.css" with { type: "css" };
import "./explorer_routes.js";

export const Explorer = () => {
  const role = useCurrentRole();
  const database = useCurrentDatabase();
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
        <FontSizedSvg>
          <DatabaseSvg />
        </FontSizedSvg>
        <select style="margin-top: 10px; margin-bottom: 10px; margin-left: 5px;">
          <option selected>{database.datname}</option>
        </select>
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
        setResizableDetailsIdSet(resizableDetailsIdSet);
      },
      onRequestedSizeChange: (element, requestedHeight) => {
        if (element.id === usersDetailsController.id) {
          usersDetailsController.setHeightSetting(requestedHeight);
        }
        if (element.id === tablesDetailsController.id) {
          tablesDetailsController.setHeightSetting(requestedHeight);
        }
        if (element.id === databasesDetailsController.id) {
          databasesDetailsController.setHeightSetting(requestedHeight);
        }
        if (element.id === groupsDetailsController.id) {
          groupsDetailsController.setHeightSetting(requestedHeight);
        }
        if (element.id === ownershipDetailsController.id) {
          ownershipDetailsController.setHeightSetting(requestedHeight);
        }
      },
    });
    return flexDetailsSet.cleanup;
  }, []);

  return (
    <div ref={flexDetailsSetRef} className="explorer_body">
      <UsersDetails
        resizable={resizableDetailsIdSet.has(usersDetailsController.id)}
      />
      <DatabasesDetails
        resizable={resizableDetailsIdSet.has(databasesDetailsController.id)}
      />
      <TablesDetails
        resizable={resizableDetailsIdSet.has(tablesDetailsController.id)}
      />
      <GroupsDetails
        resizable={resizableDetailsIdSet.has(groupsDetailsController.id)}
      />
      <OwnershipDetails
        resizable={resizableDetailsIdSet.has(ownershipDetailsController.id)}
      />
    </div>
  );
};
