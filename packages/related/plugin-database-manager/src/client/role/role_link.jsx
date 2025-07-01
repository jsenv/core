import { LinkWithIcon } from "../components/link_with_icon.jsx";
import { pickRoleIcon } from "./role_icons.jsx";
import { useCurrentRole } from "./role_store.js";

export const RoleLink = ({ role, children, ...rest }) => {
  const rolname = role.rolname;
  // const roleRouteUrl = useRouteUrl(GET_ROLE_ROUTE, { rolname });
  const roleRouteIsMatching = false;
  // const roleRouteIsMatching = useRouteIsMatching(GET_ROLE_ROUTE, { rolname });
  const currentRole = useCurrentRole();
  const isCurrent = currentRole && rolname === currentRole.rolname;
  const RoleIcon = pickRoleIcon(role);

  return (
    <LinkWithIcon
      icon={<RoleIcon color="#333" />}
      isCurrent={isCurrent}
      data-active={roleRouteIsMatching ? "" : undefined}
      href={"TODO"}
      {...rest}
    >
      {children}
    </LinkWithIcon>
  );
};
