import { Route, UITransition } from "@jsenv/navi";
import { TABLE_ROUTE, TABLE_SETTINGS_ROUTE } from "../routes.js";
import { TablePage } from "./table_page.jsx";
import { TableSettingsPage } from "./table_settings_page.jsx";

export const TableRoute = () => {
  return (
    <UITransition>
      <Route route={TABLE_ROUTE}>
        {(table) => <TablePage table={table} />}
      </Route>
      <Route route={TABLE_SETTINGS_ROUTE}>
        {(table) => <TableSettingsPage table={table} />}
      </Route>
    </UITransition>
  );
};
