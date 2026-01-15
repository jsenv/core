import { render } from "preact";

import {
  Route,
  Routes,
  setupRoutes,
  TabList,
  useRouteStatus,
} from "@jsenv/navi";

// Setup routes to test parameter inheritance
const { HOME_ROUTE, COLOR_ROUTE } = setupRoutes({
  HOME_ROUTE: "/",
  COLOR_ROUTE: "/colors{/:color}?",
});

COLOR_ROUTE.addUrlParam("color", {
  default: "red",
});

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
      <TabList>
        <TabList.Tab route={HOME_ROUTE}>Home</TabList.Tab>
        <TabList.Tab route={COLOR_ROUTE}>Colors</TabList.Tab>
      </TabList>

      <div style={{ marginTop: "20px" }}>
        <Routes>
          <Route route={HOME_ROUTE} element={<HomePage />} />
          <Route route={COLOR_ROUTE} element={<ColorPage />} />
        </Routes>
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
      {params.color && <div>Selected: {params.color}</div>}

      <div style={{ marginTop: "15px" }}>
        <TabList>
          <TabList.Tab route={COLOR_ROUTE} routeParams={{ color: "red" }}>
            Red
          </TabList.Tab>
          <TabList.Tab route={COLOR_ROUTE} routeParams={{ color: "blue" }}>
            Blue
          </TabList.Tab>
        </TabList>
      </div>
    </div>
  );
};

render(<App />, document.getElementById("app"));
