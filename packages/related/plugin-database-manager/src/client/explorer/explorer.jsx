import { initFlexDetailsSet } from "@jsenv/dom";
import { Icon, useRunOnMount } from "@jsenv/navi";
import { useLayoutEffect, useRef } from "preact/hooks";

// import { DatabaseSvg } from "../database/database_icons.jsx";
// import { useCurrentDatabase } from "../database/database_signals.js";
import { DatabasesDetails } from "../database/databases_details.jsx";
import { RoleCanLoginListDetails } from "../role/role_can_login/role_can_login_list_details.jsx";
import { RoleGroupListDetails } from "../role/role_group/role_group_list_details.jsx";
import { pickRoleIcon } from "../role/role_icons.jsx";
import { useCurrentRole } from "../role/role_store.js";
// import { RoleWithOwnershipListDetails } from "../role/role_with_ownership/role_with_ownership_list_details.jsx";
import { TableListDetails } from "../table/table_list_details.jsx";
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
        <Icon>
          <RoleIcon />
        </Icon>
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
      <div className="explorer_foot">Footer info</div>
    </nav>
  );
};

const ExplorerBody = () => {
  const flexDetailsSetRef = useRef();
  useLayoutEffect(() => {
    const flexDetails = flexDetailsSetRef.current;
    if (!flexDetails) {
      return null;
    }
    const flexDetailsSet = initFlexDetailsSet(flexDetails);
    return flexDetailsSet.cleanup;
  }, []);

  return (
    <div ref={flexDetailsSetRef} className="explorer_body">
      <RoleCanLoginListDetails />
      <RoleGroupListDetails />
      <DatabasesDetails />
      <TableListDetails />
      {/*<RoleWithOwnershipListDetails />  */}
    </div>
  );
};
