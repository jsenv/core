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

const TextAndCount = (props) => props;

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
      labelChildren={
        <TextAndCount text={"ROLE GROUPS"} count={roleCannotLoginCount} />
      }
      renderNewButtonChildren={() => <RoleGroupWithPlusSvg />}
      renderItem={(role, { children, ...props }) => (
        <RoleLink draggable={false} role={role} {...props}>
          {children}
        </RoleLink>
      )}
      useItemArrayInStore={useRoleArrayInStore}
      useCreateItemAction={(valueSignal) =>
        ROLE_CANNOT_LOGIN.POST.bindParams({
          rolname: valueSignal,
        })
      }
      useDeleteItemAction={(role) =>
        ROLE_CANNOT_LOGIN.DELETE.bindParams({
          rolname: role.rolname,
        })
      }
      useRenameItemAction={(role, valueSignal) =>
        ROLE_CANNOT_LOGIN.PUT.bindParams({
          rolname: role.rolname,
          columnName: "rolname",
          columnValue: valueSignal,
        })
      }
    >
      {roleCannotLoginArray}
    </ExplorerGroup>
  );
};
