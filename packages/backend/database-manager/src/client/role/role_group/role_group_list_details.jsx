import { useState } from "preact/hooks";

import { useRoleGroupCount } from "../../database_manager_signals.js";
import { ExplorerGroup } from "../../explorer/explorer_group.jsx";
import { ROLE_GROUP_GET_MANY_ACTION } from "../../routes.js";
import { RoleGroupWithPlusSvg } from "../role_icons.jsx";
import { RoleLink } from "../role_link.jsx";
import { ROLE_CANNOT_LOGIN, useRoleArrayInStore } from "../role_store.js";
import {
  roleGroupHeightSignal,
  roleGroupOpenSignal,
} from "./role_group_state.js";

export const RoleGroupListDetails = () => {
  const [resizable, setResizable] = useState(false);
  const roleCannotLoginCount = useRoleGroupCount();

  return (
    <ExplorerGroup
      id="role_group_list"
      open={roleGroupOpenSignal.value}
      detailsConnectedAction={ROLE_GROUP_GET_MANY_ACTION}
      detailsUIAction={(open) => {
        roleGroupOpenSignal.value = open;
      }}
      resizable={resizable}
      height={roleGroupHeightSignal.value}
      onresizeend={(e) => {
        const newHeight = e.detail.size;
        roleGroupHeightSignal.value = newHeight;
      }}
      onresizablechange={(e) => {
        setResizable(e.detail.resizable);
      }}
      idKey="oid"
      nameKey="rolname"
      label="ROLE GROUPS"
      count={roleCannotLoginCount}
      renderNewButtonChildren={() => <RoleGroupWithPlusSvg />}
      renderItem={(role, props) => (
        <RoleLink overflowEllipsis draggable={false} role={role} {...props} />
      )}
      useItemArrayInStore={useRoleArrayInStore}
      createItemAction={(rolname) =>
        ROLE_CANNOT_LOGIN.POST({
          rolname,
        })
      }
      deleteItemAction={(role) =>
        ROLE_CANNOT_LOGIN.DELETE({
          rolname: role.rolname,
        })
      }
      renameItemAction={(role, newRolname) =>
        ROLE_CANNOT_LOGIN.PUT({
          rolname: role.rolname,
          columnName: "rolname",
          columnValue: newRolname,
        })
      }
    />
  );
};
