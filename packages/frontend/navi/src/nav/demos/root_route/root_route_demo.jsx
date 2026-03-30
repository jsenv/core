import { render } from "preact";

import { Link, Nav, Route, route, setupRoutes } from "@jsenv/navi";

const HOME_ROUTE = route("");
const OTHER_ROUTE = route("/other");
setupRoutes([HOME_ROUTE, OTHER_ROUTE]);

const App = () => {
  return (
    <div
      style={{
        fontFamily: "Arial, sans-serif",
        maxWidth: "800px",
        margin: "0 auto",
        padding: "20px",
      }}
    >
      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: "8px",
          padding: "20px",
          marginTop: "20px",
        }}
      >
        <Nav>
          <Link route={HOME_ROUTE}>Home</Link>
          <Link route={OTHER_ROUTE}>Other</Link>
        </Nav>

        <Route>
          <Route route={HOME_ROUTE} element={"Home"} />
          <Route route={OTHER_ROUTE} element={"Other"} />
        </Route>
      </div>
    </div>
  );
};

render(<App />, document.getElementById("app"));
