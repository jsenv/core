import { Route } from "@jsenv/navi";
import { DATABASE_ROUTE } from "../routes.js";
import { DatabasePage } from "./database_page.jsx";

export const DatabaseRoutes = () => {
  return (
    <Route route={DATABASE_ROUTE}>
      {(database) => <DatabasePage database={database} />}
    </Route>
  );
};
