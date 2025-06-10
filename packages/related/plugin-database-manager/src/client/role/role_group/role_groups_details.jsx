import { useRouteIsMatching } from "@jsenv/router";
import { TextAndCount } from "../../components/text_and_count.jsx";
import {
  createExplorerGroupController,
  ExplorerGroup,
} from "../../explorer/explorer_group.jsx";
import { RoleGroupWithPlusSvg } from "../role_icons.jsx";
import { RoleLink } from "../role_link.jsx";
import {
  DELETE_ROLE_ACTION,
  GET_ROLE_ROUTE,
  POST_ROLE_ACTION,
  PUT_ROLE_ACTION,
} from "../role_routes.js";
import { useRoleList } from "../role_signals.js";
import { useRoleGroupCount, useRoleGroupList } from "./role_group_signals.js";
import { ROLE_GROUPS_DETAILS_ROUTE } from "./role_groups_details_routes.js";

export const roleGroupsDetailsController =
  createExplorerGroupController("groups");

export const RoleGroupsDetails = (props) => {
  const roleGroupCount = useRoleGroupCount();
  const roleGroups = useRoleGroupList();

  return (
    <ExplorerGroup
      {...props}
      controller={roleGroupsDetailsController}
      detailsRoute={ROLE_GROUPS_DETAILS_ROUTE}
      idKey="oid"
      nameKey="rolname"
      labelChildren={
        <TextAndCount text={"ROLE GROUPS"} count={roleGroupCount} />
      }
      renderNewButtonChildren={() => <RoleGroupWithPlusSvg />}
      renderItem={(role, { children, ...props }) => (
        <RoleLink role={role} {...props}>
          {children}
        </RoleLink>
      )}
      useItemList={useRoleList}
      useItemRouteIsActive={(role) =>
        useRouteIsMatching(GET_ROLE_ROUTE, {
          rolname: role.rolname,
        })
      }
      useRenameItemAction={(role) =>
        PUT_ROLE_ACTION.bindParams({
          rolname: role.rolname,
          columnName: "rolname",
        })
      }
      useCreateItemAction={() => POST_ROLE_ACTION}
      useDeleteItemAction={(role) =>
        DELETE_ROLE_ACTION.bindParams({
          rolname: role.rolname,
        })
      }
    >
      {roleGroups}
    </ExplorerGroup>
  );
};
