import { UITransition } from "@jsenv/navi";
import { DatabaseRoutes } from "./database/database_routes.jsx";
import "./database_manager.css" with { type: "css" };
import "./layout/layout.css" with { type: "css" };
import { RoleRoutes } from "./role/role_routes.jsx";
import "./store.js";
import { TableRoutes } from "./table/table_routes.jsx";

export const MainRoutes = () => {
  return (
    <UITransition debugTransition>
      <RoleRoutes />
      <DatabaseRoutes />
      <TableRoutes />
    </UITransition>
  );
};
