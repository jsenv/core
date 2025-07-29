import { Route } from "@jsenv/navi";
import { render } from "preact";
import { DatabasePage } from "./database/database_page.jsx";
import "./database_manager.css" with { type: "css" };
import { Explorer } from "./explorer/explorer.jsx";
import { Aside } from "./layout/aside.jsx";
import "./layout/layout.css" with { type: "css" };
import { RolePage } from "./role/role_page.jsx";
import { DATABASE_ROUTE, ROLE_ROUTE, TABLE_ROUTE } from "./routes.js";
import "./store.js";
import { TablePage } from "./table/table_page.jsx";

const App = () => {
  return (
    <div id="app">
      <Aside>
        <Explorer />
      </Aside>
      <main>
        <div className="main_body">
          <Route route={ROLE_ROUTE}>{(role) => <RolePage role={role} />}</Route>
          <Route route={DATABASE_ROUTE}>
            {(database) => <DatabasePage database={database} />}
          </Route>
          <Route route={TABLE_ROUTE}>
            {(table) => <TablePage table={table} />}
          </Route>
        </div>
      </main>
    </div>
  );
};

render(<App />, document.querySelector("#root"));
