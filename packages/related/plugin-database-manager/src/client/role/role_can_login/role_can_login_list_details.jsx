import { TextAndCount } from "../../components/text_and_count.jsx";
import {
  createExplorerGroupController,
  ExplorerGroup,
} from "../../explorer/explorer_group.jsx";
import { RoleCanLoginWithPlusSvg } from "../role_icons.jsx";
import { RoleLink } from "../role_link.jsx";
import { ROLE } from "../role_store.js";
import { ROLE_CAN_LOGIN_LIST_DETAILS_ROUTE } from "./role_can_login_list_details_routes.js";
import {
  useRoleCanLoginCount,
  useRoleCanLoginList,
} from "./role_can_login_signals.js";

export const roleCanLoginListDetailsController = createExplorerGroupController(
  "role_can_login_list",
);

export const RoleCanLoginListDetails = (props) => {
  const roleCanLoginCount = useRoleCanLoginCount();
  const roleCanLoginList = useRoleCanLoginList();

  return (
    <ExplorerGroup
      {...props}
      controller={roleCanLoginListDetailsController}
      detailsRoute={ROLE_CAN_LOGIN_LIST_DETAILS_ROUTE}
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
      useItemList={useRoleList}
      useRenameItemAction={(role) =>
        ROLE.PUT.bindParams({
          rolname: role.rolname,
          columnName: "rolname",
        })
      }
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
      {roleCanLoginList}
    </ExplorerGroup>
  );
};
