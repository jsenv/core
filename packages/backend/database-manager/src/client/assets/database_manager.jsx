import { Loading } from "@jsenv/navi";
import { render } from "preact";

import { DATABASE, setCurrentDatabaseId } from "./database/database_store.js";
import "./database_manager.css" with { type: "css" };
import { Explorer } from "./explorer/explorer.jsx";
import { Aside } from "./layout/aside.jsx";
import "./layout/layout.css" with { type: "css" };
import { MainRoutes } from "./main_routes.jsx";
import { ROLE, setCurrentRoleId } from "./role/role_store.js";

const initResponse = await fetch(`${window.DB_MANAGER_CONFIG.apiUrl}/explorer`);
const { data: initData } = await initResponse.json();
ROLE.store.upsert(initData.currentRole);
setCurrentRoleId(initData.currentRole.oid);
DATABASE.store.upsert(initData.currentDatabase);
setCurrentDatabaseId(initData.currentDatabase.oid);

const App = () => {
  return (
    <div id="app">
      <Aside>
        <Explorer />
      </Aside>
      <main>
        <div className="main_body">
          <Loading>
            <MainRoutes />
          </Loading>
        </div>
      </main>
    </div>
  );
};

render(<App />, document.querySelector("#root"));
