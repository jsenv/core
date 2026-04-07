import { Route } from "@jsenv/navi";

import { DatabasePage } from "./database/database_page.jsx";
import "./database_manager.css" with { type: "css" };
import "./layout/layout.css" with { type: "css" };
import { NotFoundPage } from "./not_found_page.jsx";
import { RolePage } from "./role/role_page.jsx";
import {
  DATABASE_ROUTE,
  INDEX_ROUTE,
  ROLE_ROUTE,
  TABLE_ROUTE,
} from "./routes.js";
import "./store.js";
import { TablePage } from "./table/table_page.jsx";

export const MainRoutes = () => {
  return (
    <Route>
      <Route route={INDEX_ROUTE} element={"Bienvenue"} />
      <Route route={ROLE_ROUTE} element={RolePage} />
      <Route route={DATABASE_ROUTE} element={DatabasePage} />
      <Route route={TABLE_ROUTE} element={TablePage} />
      <Route fallback element={NotFoundPage} />
    </Route>
  );
};
