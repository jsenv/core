import { useRoleGroupCount } from "../../database_manager_signals.js";
import {
  createExplorerGroupController,
  ExplorerGroup,
} from "../../explorer/explorer_group.jsx";
import { RoleGroupWithPlusSvg } from "../role_icons.jsx";
import { RoleLink } from "../role_link.jsx";
import {
  ROLE_CANNOT_LOGIN,
  useRoleArrayInStore,
  useRoleCannotLoginArray,
} from "../role_store.js";
import {
  roleGroupListDetailsOnToggle,
  roleGroupListDetailsOpenAtStart,
} from "./role_group_list_details_state.js";

export const roleGroupListDetailsController = createExplorerGroupController(
  "role_group_list",
  {
    detailsOpenAtStart: roleGroupListDetailsOpenAtStart,
    detailsOnToggle: roleGroupListDetailsOnToggle,
  },
);

export const RoleGroupListDetails = (props) => {
  const roleCannotLoginCount = useRoleGroupCount();
  const roleCannotLoginArray = useRoleCannotLoginArray();

  return (
    <ExplorerGroup
      {...props}
      controller={roleGroupListDetailsController}
      detailsAction={ROLE_CANNOT_LOGIN.GET_MANY}
      idKey="oid"
      nameKey="rolname"
      label="ROLE GROUPS"
      count={roleCannotLoginCount}
      renderNewButtonChildren={() => <RoleGroupWithPlusSvg />}
      renderItem={(role, props) => (
        <RoleLink draggable={false} role={role} {...props} />
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
    >
      {roleCannotLoginArray}
    </ExplorerGroup>
  );
};
