import { TextAndCount } from "../../components/text_and_count.jsx";
import { useRoleGroupCount } from "../../database_signals.js";
import {
  createExplorerGroupController,
  ExplorerGroup,
} from "../../explorer/explorer_group.jsx";
import { RoleGroupWithPlusSvg } from "../role_icons.jsx";
import { RoleLink } from "../role_link.jsx";
import { ROLE, useRoleArray, useRoleGroupArray } from "../role_store.js";
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
  const roleGroupCount = useRoleGroupCount();
  const roleGroupArray = useRoleGroupArray();

  return (
    <ExplorerGroup
      {...props}
      controller={roleGroupListDetailsController}
      detailsAction={ROLE.GET_MANY_GROUP}
      idKey="oid"
      nameKey="rolname"
      labelChildren={
        <TextAndCount text={"ROLE GROUPS"} count={roleGroupCount} />
      }
      renderNewButtonChildren={() => <RoleGroupWithPlusSvg />}
      renderItem={(role, { children, ...props }) => (
        <RoleLink draggable={false} role={role} {...props}>
          {children}
        </RoleLink>
      )}
      useItemArrayInStore={useRoleArray}
      useRenameItemAction={(role) => {
        const renameAction = ROLE.PUT.bindParams({
          rolname: role.rolname,
          columnName: "rolname",
        });
        renameAction.meta.valueParamName = "columnValue";
        return renameAction;
      }}
      useCreateItemAction={() => ROLE.POST}
      useDeleteItemAction={(role) =>
        ROLE.DELETE.bindParams({
          rolname: role.rolname,
        })
      }
    >
      {roleGroupArray}
    </ExplorerGroup>
  );
};
