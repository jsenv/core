import { render } from "preact";
import "./database_manager.css" with { type: "css" };
import { Explorer } from "./explorer/explorer.jsx";
import { Aside } from "./layout/aside.jsx";
import "./layout/layout.css" with { type: "css" };
import { MainRoutes } from "./main_routes.jsx";
import "./store.js";

const App = () => {
  return (
    <div id="app">
      <Aside>
        <Explorer />
      </Aside>
      <main>
        <div className="main_body">
          <MainRoutes />
        </div>
      </main>
    </div>
  );
};

render(<App />, document.querySelector("#root"));
