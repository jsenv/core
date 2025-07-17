import { useRouteStatus } from "@jsenv/navi";
import { LinkWithIcon } from "../components/link_with_icon.jsx";
import { ROLE_ROUTE } from "../routes.js";
import { pickRoleIcon } from "./role_icons.jsx";
import { useCurrentRole } from "./role_store.js";

export const RoleLink = ({ role, children, ...rest }) => {
  const rolname = role.rolname;
  const roleUrl = ROLE_ROUTE.buildUrl({ rolname });
  const { params } = useRouteStatus(ROLE_ROUTE);
  const activeRolname = params.rolname;
  const isActive = activeRolname === rolname;
  const currentRole = useCurrentRole();
  const isCurrent = currentRole && rolname === currentRole.rolname;
  const RoleIcon = pickRoleIcon(role);

  return (
    <LinkWithIcon
      icon={<RoleIcon color="#333" />}
      isCurrent={isCurrent}
      data-active={isActive ? "" : undefined}
      href={roleUrl}
      {...rest}
    >
      {children}
    </LinkWithIcon>
  );
};
