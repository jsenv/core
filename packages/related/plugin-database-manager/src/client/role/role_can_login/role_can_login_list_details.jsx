import { TextAndCount } from "../../components/text_and_count.jsx";
import {
  createExplorerGroupController,
  ExplorerGroup,
} from "../../explorer/explorer_group.jsx";
import { RoleCanLoginWithPlusSvg } from "../role_icons.jsx";
import { RoleLink } from "../role_link.jsx";
import {
  ROLE,
  useRoleArray,
  useRoleCanLoginArray,
  useRoleCanLoginCount,
} from "../role_store.js";

export const roleCanLoginListDetailsController = createExplorerGroupController(
  "role_can_login_list",
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
      useItemList={useRoleArray}
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
      {roleCanLoginArray}
    </ExplorerGroup>
  );
};
