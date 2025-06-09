import { Route } from "@jsenv/router";
import { RoleGroupPage } from "./group/role_group_page.jsx";
import { GET_ROLE_ROUTE } from "./role_routes.js";
import { useActiveRole } from "./role_signals.js";
import { UserPage } from "./user/user_page.jsx";

export const RoleRoutes = () => {
  return <Route route={GET_ROLE_ROUTE} renderLoaded={() => <RolePage />} />;
};

const RolePage = () => {
  const role = useActiveRole();
  if (role.rolcanlogin) {
    return <UserPage />;
  }
  return <RoleGroupPage />;
};
