import { Route } from "@jsenv/navi";
import { TABLE_ROUTE } from "../routes.js";
import { TablePage } from "./table_page.jsx";

export const TableRoutes = () => {
  return (
    <Route
      route={TABLE_ROUTE}
      debug
      element={{
        always: ({ completed, data }) => {
          if (completed) {
            return <TablePage table={data} />;
          }
          return "Coucou";
        },
      }}
    />
  );
};
