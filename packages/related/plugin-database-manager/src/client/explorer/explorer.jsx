/**
 * each section should have its own scrollbar
 * right now it does not work, the content is not scrollable and gets hidden
 */

import { initFlexDetailsSet } from "@jsenv/dom";
import { useCallback, useLayoutEffect, useRef, useState } from "preact/hooks";
import { FontSizedSvg } from "../components/font_sized_svg.jsx";
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
  ownersshipDetailsController,
} from "../role/ownership/ownership_details.jsx";
import { pickRoleIcon } from "../role/role_icons.jsx";
import { useCurrentRole } from "../role/role_signals.js";
import {
  UsersDetails,
  usersDetailsController,
} from "../role/user/users_details.jsx";
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
  const [detailsOpenCount, setDetailsOpenCount] = useState(0);
  const resizable = detailsOpenCount > 1;
  const onOpen = useCallback(() => {
    setDetailsOpenCount((count) => count + 1);
  }, []);
  const onClose = useCallback(() => {
    setDetailsOpenCount((count) => count - 1);
  }, []);
  const flexDetailsSetRef = useRef();

  useLayoutEffect(() => {
    const flexDetailsSet = initFlexDetailsSet(flexDetailsSetRef.current, {
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
        if (element.id === ownersshipDetailsController.id) {
          ownersshipDetailsController.setHeightSetting(requestedHeight);
        }
      },
    });
    return flexDetailsSet.cleanup;
  }, []);

  return (
    <div
      ref={flexDetailsSetRef}
      className="explorer_body"
      onToggle={(toggleEvent) => {
        if (toggleEvent.newState === "open") {
          setDetailsOpenCount((count) => count + 1);
        } else {
          setDetailsOpenCount((count) => count - 1);
        }
      }}
    >
      <UsersDetails onOpen={onOpen} onClose={onClose} />
      <DatabasesDetails
        onOpen={onOpen}
        onClose={onClose}
        resizable={resizable}
      />
      <TablesDetails onOpen={onOpen} onClose={onClose} resizable={resizable} />
      <GroupsDetails onOpen={onOpen} onClose={onClose} resizable={resizable} />
      <OwnershipDetails
        onOpen={onOpen}
        onClose={onClose}
        resizable={resizable}
      />
    </div>
  );
};
