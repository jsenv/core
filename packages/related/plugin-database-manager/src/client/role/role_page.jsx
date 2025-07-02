import { Route } from "@jsenv/router";
import { RoleCanLoginPage } from "./role_can_login/role_can_login_page.jsx";
import { RoleGroupPage } from "./role_group/role_group_page.jsx";
import { GET_ROLE_ROUTE } from "./role_routes.js";
import { useActiveRole } from "./role_signals.js";

export const RoleRoutes = () => {
  return <Route route={GET_ROLE_ROUTE} renderLoaded={() => <RolePage />} />;
};

const RolePage = () => {
  const role = useActiveRole();
  if (role.rolcanlogin) {
    return <RoleCanLoginPage role={role} />;
  }
  return <RoleGroupPage role={role} />;
};
