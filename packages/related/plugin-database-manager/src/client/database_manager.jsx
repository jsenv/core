import { render } from "preact";
import { Route } from "@jsenv/router";
import "./database_manager.css" with { type: "css" };
import { DatabaseNavbar } from "./database_navbar.jsx";
import { TablePage } from "./table/table_page.jsx";
import { UserPage } from "./user/user_page.jsx";
import { GET_TABLES, GET_USER } from "./routes.js";

const App = () => {
  return (
    <div>
      <aside>
        <DatabaseNavbar />
      </aside>
      <main>
        <h1 title="Explore and manager your database">Database Manager</h1>

        <Route route={GET_TABLES} loaded={TablePage} />
        <Route route={GET_USER} loaded={UserPage} />
      </main>
    </div>
  );
};

render(<App />, document.querySelector("#app"));
