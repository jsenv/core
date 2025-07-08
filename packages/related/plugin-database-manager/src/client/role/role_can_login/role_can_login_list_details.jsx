import { TextAndCount } from "../../components/text_and_count.jsx";
import { useRoleCanLoginCount } from "../../database_signals.js";
import {
  createExplorerGroupController,
  ExplorerGroup,
} from "../../explorer/explorer_group.jsx";
import { RoleCanLoginWithPlusSvg } from "../role_icons.jsx";
import { RoleLink } from "../role_link.jsx";
import { ROLE, useRoleArray, useRoleCanLoginArray } from "../role_store.js";
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
      detailsAction={ROLE.GET_MANY_CAN_LOGIN}
      idKey="oid"
      nameKey="rolname"
      labelChildren={
        <TextAndCount text={"ROLE LOGINS"} count={roleCanLoginCount} />
      }
      renderNewButtonChildren={() => <RoleCanLoginWithPlusSvg />}
      renderItem={(role, { children, ...props }) => (
        <RoleLink role={role} {...props}>
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
      useCreateItemAction={() =>
        ROLE.POST.bindParams({
          rolcanlogin: true,
        })
      }
      useDeleteItemAction={(role) =>
        ROLE.DELETE.bindParams({
          rolname: role.rolname,
        })
      }
    >
      {roleCanLoginArray}
    </ExplorerGroup>
  );
};
