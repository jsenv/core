import { useRouteIsMatching } from "@jsenv/router";
import { TextAndCount } from "../../components/text_and_count.jsx";
import {
  createExplorerGroupController,
  ExplorerGroup,
} from "../../explorer/explorer_group.jsx";
import { UserWithPlusSvg } from "../role_icons.jsx";
import { RoleLink } from "../role_link.jsx";
import {
  DELETE_ROLE_ACTION,
  GET_ROLE_ROUTE,
  POST_ROLE_ACTION,
  PUT_ROLE_ACTION,
} from "../role_routes.js";
import { useRoleList } from "../role_signals.js";
import { useGroupCount, useGroupList } from "./group_signals.js";
import { GROUPS_DETAILS_ROUTE } from "./groups_details_routes.js";

export const rolesExplorerGroupController =
  createExplorerGroupController("roles");

export const GroupsDetails = (props) => {
  const groups = useGroupList();
  const groupCount = useGroupCount();

  return (
    <ExplorerGroup
      {...props}
      controller={rolesExplorerGroupController}
      detailsRoute={GROUPS_DETAILS_ROUTE}
      idKey="oid"
      nameKey="rolname"
      labelChildren={<TextAndCount text={"GROUPS"} count={groupCount} />}
      renderNewButtonChildren={() => <UserWithPlusSvg />}
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
      {groups}
    </ExplorerGroup>
  );
};
