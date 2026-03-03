import { RouteLink } from "@jsenv/navi";

import { ROLE_ROUTE } from "../routes.js";
import { pickRoleIcon } from "./role_icons.jsx";
import { useCurrentRole } from "./role_store.js";

export const RoleLink = ({ role, children, ...rest }) => {
  const rolname = role.rolname;
  const currentRole = useCurrentRole();
  const isCurrent = currentRole && rolname === currentRole.rolname;
  const RoleIcon = pickRoleIcon(role);

  return (
    <RouteLink
      startIcon={<RoleIcon color="#333" />}
      route={ROLE_ROUTE}
      routeParams={{ rolname }}
      {...rest}
    >
      {isCurrent && <span>(current)</span>}
      {children}
    </RouteLink>
  );
};
