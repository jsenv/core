import { Route, UITransition } from "@jsenv/navi";
import { DatabasePage } from "./database/database_page.jsx";
import "./database_manager.css" with { type: "css" };
import "./layout/layout.css" with { type: "css" };
import { RolePage } from "./role/role_page.jsx";
import { DATABASE_ROUTE, ROLE_ROUTE } from "./routes.js";
import "./store.js";
import { TableRoute } from "./table/table_route.jsx";

export const MainRoutes = () => {
  return (
    <UITransition>
      <Route route={ROLE_ROUTE}>{(role) => <RolePage role={role} />}</Route>
      <Route route={DATABASE_ROUTE}>
        {(database) => <DatabasePage database={database} />}
      </Route>
      <TableRoute />{" "}
    </UITransition>
  );
};
