import { Route } from "@jsenv/navi";
import { render } from "preact";
import "./database_manager.css" with { type: "css" };
import { Explorer } from "./explorer/explorer.jsx";
import { Aside } from "./layout/aside.jsx";
import "./layout/layout.css" with { type: "css" };
import { RolePage } from "./role/role_page.jsx";
import { ROLE_ROUTE } from "./routes.js";

const App = () => {
  return (
    <div id="app">
      <Aside>
        <Explorer />
      </Aside>
      <main>
        <div className="main_body">
          <Route route={ROLE_ROUTE}>{(role) => <RolePage role={role} />}</Route>
        </div>
      </main>
    </div>
  );
};

render(<App />, document.querySelector("#root"));
