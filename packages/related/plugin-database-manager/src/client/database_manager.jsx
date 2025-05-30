// organize-imports-ignore
import "./router.js"; // must be the first import (so that setBaseUrl is called for any other import)
import { render } from "preact";
import { DatabaseRoutes } from "./database/database_page.jsx";
import "./layout/layout.css" with { type: "css" };
import "./database_manager.css" with { type: "css" };
import { Aside } from "./layout/aside.jsx";
import { Explorer } from "./explorer/explorer.jsx";
import { RoleRoutes } from "./role/role_page.jsx";
import { TableRoutes } from "./table/table_page.jsx";

const App = () => {
  return (
    <div id="app">
      <Aside>
        <Explorer />
      </Aside>
      <main>
        <div className="main_body">
          <RoleRoutes />
          <DatabaseRoutes />
          <TableRoutes />
        </div>
      </main>
    </div>
  );
};

render(<App />, document.querySelector("#root"));

if (import.meta.hot) {
  // jsenv router does not support hot reload (yet)
  import.meta.hot.decline();
}
