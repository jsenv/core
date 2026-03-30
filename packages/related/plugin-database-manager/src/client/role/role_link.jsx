import { Link } from "@jsenv/navi";

import { ROLE_ROUTE } from "../routes.js";
import { pickRoleIcon } from "./role_icons.jsx";
import { useCurrentRole } from "./role_store.js";

export const RoleLink = ({ role, children, ...rest }) => {
  const rolname = role.rolname;
  const currentRole = useCurrentRole();
  const isCurrent = currentRole && rolname === currentRole.rolname;
  const RoleIcon = pickRoleIcon(role);

  return (
    <Link
      route={ROLE_ROUTE}
      routeParams={{ rolname }}
      startIcon={<RoleIcon color="#333" />}
      {...rest}
    >
      {isCurrent && <span>(current)</span>}
      {children}
    </Link>
  );
};
