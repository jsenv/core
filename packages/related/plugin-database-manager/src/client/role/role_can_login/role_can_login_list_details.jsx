import { TextAndCount } from "@jsenv/navi";
import { useRoleCanLoginCount } from "../../database_manager_signals.js";
import {
  createExplorerGroupController,
  ExplorerGroup,
} from "../../explorer/explorer_group.jsx";
import { RoleCanLoginWithPlusSvg } from "../role_icons.jsx";
import { RoleLink } from "../role_link.jsx";
import {
  ROLE_CAN_LOGIN,
  useRoleArrayInStore,
  useRoleCanLoginArray,
} from "../role_store.js";
import {
  roleCanLoginListDetailsOnToggle,
  roleCanLoginListDetailsOpenAtStart,
} from "./role_can_login_list_details_state.js";

export const roleCanLoginListDetailsController = createExplorerGroupController(
  "role_can_login_list",
  {
    detailsOpenAtStart: roleCanLoginListDetailsOpenAtStart,
    detailsOnToggle: roleCanLoginListDetailsOnToggle,
  },
);

export const RoleCanLoginListDetails = (props) => {
  const roleCanLoginCount = useRoleCanLoginCount();
  const roleCanLoginArray = useRoleCanLoginArray();

  return (
    <ExplorerGroup
      {...props}
      controller={roleCanLoginListDetailsController}
      detailsAction={ROLE_CAN_LOGIN.GET_MANY}
      idKey="oid"
      nameKey="rolname"
      labelChildren={
        <TextAndCount text={"ROLE LOGINS"} count={roleCanLoginCount} />
      }
      renderNewButtonChildren={() => <RoleCanLoginWithPlusSvg />}
      renderItem={(role, props) => (
        <RoleLink draggable={false} role={role} {...props} />
      )}
      useItemArrayInStore={useRoleArrayInStore}
      useCreateItemAction={(valueSignal) =>
        ROLE_CAN_LOGIN.POST.bindParams({
          rolname: valueSignal,
        })
      }
      useDeleteItemAction={(role) =>
        ROLE_CAN_LOGIN.DELETE.bindParams({
          rolname: role.rolname,
        })
      }
      useRenameItemAction={(role, valueSignal) =>
        ROLE_CAN_LOGIN.PUT.bindParams({
          rolname: role.rolname,
          columnName: "rolname",
          columnValue: valueSignal,
        })
      }
    >
      {roleCanLoginArray}
    </ExplorerGroup>
  );
};
