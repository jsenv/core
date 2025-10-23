import { Route } from "@jsenv/navi";
import { TABLE_ROUTE } from "../routes.js";
import { TablePage } from "./table_page.jsx";

export const TableRoutes = () => {
  return (
    <Route route={TABLE_ROUTE}>{(table) => <TablePage table={table} />}</Route>
  );
};
