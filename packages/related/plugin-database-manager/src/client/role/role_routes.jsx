import { Route } from "@jsenv/navi";

import { ROLE_GET_ACTION, ROLE_ROUTE } from "../routes.js";
import { RolePage } from "./role_page.jsx";

export const RoleRoutes = () => {
  return (
    <Route
      route={ROLE_ROUTE}
      action={ROLE_GET_ACTION}
      element={(role) => <RolePage role={role} />}
    />
  );
};
