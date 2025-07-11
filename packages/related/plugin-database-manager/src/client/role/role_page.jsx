import { Route } from "@jsenv/router";
import { RoleCanLoginPage } from "./role_can_login/role_can_login_page.jsx";
import { RoleGroupPage } from "./role_group/role_group_page.jsx";
import { ROLE } from "./role_store.js";

// maintenant voici ce que je veux:
// si l'url match un truc bien particulier

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
