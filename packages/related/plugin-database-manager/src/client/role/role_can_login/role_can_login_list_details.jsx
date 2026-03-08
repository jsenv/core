import { useState } from "preact/hooks";

import { useRoleCanLoginCount } from "../../database_manager_signals.js";
import { ExplorerGroup } from "../../explorer/explorer_group.jsx";
import { ROLE_CAN_LOGIN_GET_MANY_ACTION } from "../../routes.js";
import { RoleCanLoginWithPlusSvg } from "../role_icons.jsx";
import { RoleLink } from "../role_link.jsx";
import {
  ROLE_CAN_LOGIN,
  useRoleArrayInStore,
  useRoleCanLoginArray,
} from "../role_store.js";
import {
  roleCanLoginHeightSignal,
  roleCanLoginOpenSignal,
} from "./role_can_login_state.js";

export const RoleCanLoginListDetails = () => {
  const [resizable, setResizable] = useState(false);
  const roleCanLoginCount = useRoleCanLoginCount();
  const roleCanLoginArray = useRoleCanLoginArray();

  return (
    <ExplorerGroup
      id="role_can_login_list"
      open={roleCanLoginOpenSignal.value}
      detailsConnectedAction={ROLE_CAN_LOGIN_GET_MANY_ACTION}
      detailsUIAction={(open) => {
        roleCanLoginOpenSignal.value = open;
      }}
      resizable={resizable}
      height={roleCanLoginHeightSignal.value}
      onresizeend={(e) => {
        const newHeight = e.detail.size;
        roleCanLoginHeightSignal.value = newHeight;
      }}
      onresizablechange={(e) => {
        setResizable(e.detail.resizable);
      }}
      idKey="oid"
      nameKey="rolname"
      label="ROLE LOGINS"
      count={roleCanLoginCount}
      renderNewButtonChildren={() => <RoleCanLoginWithPlusSvg />}
      renderItem={(role, props) => {
        return (
          <RoleLink overflowEllipsis draggable={false} role={role} {...props} />
        );
      }}
      useItemArrayInStore={useRoleArrayInStore}
      createItemAction={(rolname) =>
        ROLE_CAN_LOGIN.POST({
          rolname,
        })
      }
      deleteItemAction={(role) =>
        ROLE_CAN_LOGIN.DELETE({
          rolname: role.rolname,
        })
      }
      renameItemAction={(role, newRolname) =>
        ROLE_CAN_LOGIN.PUT.bindParams({
          rolname: role.rolname,
          columnName: "rolname",
          columnValue: newRolname,
        })
      }
    >
      {roleCanLoginArray}
    </ExplorerGroup>
  );
};
