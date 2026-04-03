import { Route } from "@jsenv/navi";

import { DatabasePage } from "./database/database_page.jsx";
import "./database_manager.css" with { type: "css" };
import "./layout/layout.css" with { type: "css" };
import { RolePage } from "./role/role_page.jsx";
import {
  DATABASE_GET_ACTION,
  DATABASE_ROUTE,
  INDEX_ROUTE,
  ROLE_GET_ACTION,
  ROLE_ROUTE,
  TABLE_GET_ACTION,
  TABLE_ROUTE,
} from "./routes.js";
import "./store.js";
import { TablePage } from "./table/table_page.jsx";

export const MainRoutes = () => {
  return (
    <Route>
      <Route route={INDEX_ROUTE} element={"Bienvenue"} />
      <Route
        route={ROLE_ROUTE}
        action={ROLE_GET_ACTION}
        element={(role) => <RolePage role={role} />}
      />
      <Route
        route={DATABASE_ROUTE}
        action={DATABASE_GET_ACTION}
        element={(database) => <DatabasePage database={database} />}
      />
      <Route
        route={TABLE_ROUTE}
        action={TABLE_GET_ACTION}
        element={(table) => <TablePage table={table} />}
      />
      <Route fallback element={"Page not found"} />
    </Route>
  );
};
