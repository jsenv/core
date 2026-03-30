import { render } from "preact";

import {
  Link,
  Nav,
  Route,
  route,
  setupRoutes,
  stateSignal,
  useRouteStatus,
} from "@jsenv/navi";

const colorSignal = stateSignal("red", {
  enum: ["red", "blue"],
  invalidEffect: "redirect",
});
const HOME_ROUTE = route("");
const COLOR_ROUTE = route(`/colors/:color=${colorSignal}`);
setupRoutes([HOME_ROUTE, COLOR_ROUTE]);

const App = () => {
  return (
    <div
      style={{
        fontFamily: "Arial, sans-serif",
        maxWidth: "600px",
        margin: "0 auto",
        padding: "20px",
      }}
    >
      <Nav>
        <Link route={HOME_ROUTE} appearance="tab" padding="s" currentIndicator>
          Home
        </Link>
        <Link route={COLOR_ROUTE} appearance="tab" padding="s" currentIndicator>
          Colors
        </Link>
      </Nav>

      <div style={{ marginTop: "20px" }}>
        <Route>
          <Route route={HOME_ROUTE} element={<HomePage />} />
          <Route route={COLOR_ROUTE} element={<ColorPage />} />
        </Route>
      </div>
    </div>
  );
};

const HomePage = () => {
  return <div>Home page</div>;
};

const ColorPage = () => {
  const { params } = useRouteStatus(COLOR_ROUTE);

  return (
    <div>
      <div>Color page</div>

      <Link route={COLOR_ROUTE} routeParams={{ color: "black" }}></Link>

      <div>Current color: {params.color}</div>

      <div style={{ marginTop: "15px" }}>
        <Nav>
          <Link
            route={COLOR_ROUTE}
            routeParams={{ color: "red" }}
            appearance="tab"
            padding="s"
            currentIndicator
          >
            Red
          </Link>
          <Link
            route={COLOR_ROUTE}
            routeParams={{ color: "blue" }}
            appearance="tab"
            padding="s"
            currentIndicator
          >
            Blue
          </Link>
        </Nav>
      </div>
    </div>
  );
};

render(<App />, document.getElementById("app"));
