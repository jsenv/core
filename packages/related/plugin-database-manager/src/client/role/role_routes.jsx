import { Route, UITransition } from "@jsenv/navi";
import { ROLE_ROUTE } from "../routes.js";
import { RolePage } from "./role_page.jsx";

export const RoleRoutes = () => {
  return (
    <UITransition>
      <Route route={ROLE_ROUTE}>{(role) => <RolePage role={role} />}</Route>
    </UITransition>
  );
};
