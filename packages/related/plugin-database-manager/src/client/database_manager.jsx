import "./router.js"; // must be the first import (so that setBaseUrl is called for any other import)
import { render } from "preact";
import "./database_manager.css" with { type: "css" };
import { DatabaseNavbar } from "./database_navbar.jsx";
import { TableRoutes } from "./table/table_page.jsx";
import { UserRoutes } from "./user/user_page.jsx";

const App = () => {
  return (
    <div>
      <aside>
        <DatabaseNavbar />
      </aside>
      <main>
        <h1 title="Explore and manager your database">Database Manager</h1>

        <UserRoutes />
        <TableRoutes />
      </main>
    </div>
  );
};

render(<App />, document.querySelector("#app"));
