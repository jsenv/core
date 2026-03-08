import { Route } from "@jsenv/navi";

import { TABLE_GET_ACTION, TABLE_ROUTE } from "../routes.js";
import { TablePage } from "./table_page.jsx";

export const TableRoutes = () => {
  return (
    <Route
      route={TABLE_ROUTE}
      action={TABLE_GET_ACTION}
      element={(table) => <TablePage table={table} />}
    />
  );
};
