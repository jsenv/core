import { useRouteUrl } from "@jsenv/router";
import { LinkWithIcon } from "../components/link_with_icon.jsx";
import { pickRoleIcon } from "./role_icons.jsx";
import { GET_ROLE_ROUTE } from "./role_routes.js";
import { useCurrentRole } from "./role_signals.js";

export const RoleLink = ({ role, children, ...rest }) => {
  const rolname = role.rolname;
  const roleRouteUrl = useRouteUrl(GET_ROLE_ROUTE, { rolname });
  const currentRole = useCurrentRole();
  const isCurrent = currentRole && rolname === currentRole.rolname;
  const RoleIcon = pickRoleIcon(role);

  return (
    <LinkWithIcon
      icon={<RoleIcon color="#333" />}
      isCurrent={isCurrent}
      href={roleRouteUrl}
      {...rest}
    >
      {children}
    </LinkWithIcon>
  );
};
