import { Route } from "@jsenv/navi";

import { DATABASE_GET_ACTION, DATABASE_ROUTE } from "../routes.js";
import { DatabasePage } from "./database_page.jsx";

export const DatabaseRoutes = () => {
  return (
    <Route
      route={DATABASE_ROUTE}
      action={DATABASE_GET_ACTION}
      element={(database) => <DatabasePage database={database} />}
    />
  );
};
