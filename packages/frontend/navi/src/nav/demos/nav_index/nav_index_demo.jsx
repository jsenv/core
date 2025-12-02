import { Box, Route, Routes, setupRoutes, Tab, TabList } from "@jsenv/navi";
import { render } from "preact";

const { HOME_ROUTE, MAP_ROUTE, MAP_TAB_A_ROUTE, MAP_TAB_B_ROUTE } = setupRoutes(
  {
    HOME_ROUTE: "home",
    MAP_ROUTE: "map",
    MAP_TAB_A_ROUTE: "map/tab_a",
    MAP_TAB_B_ROUTE: "map/tab_b",
  },
);

const App = () => {
  return (
    <div>
      <TabList>
        <Tab route={HOME_ROUTE}>Home</Tab>
        <Tab route={MAP_ROUTE} routeParams="?toto">
          Map
        </Tab>
      </TabList>

      <main>
        <Routes>
          <Route route={HOME_ROUTE} element={<Home />} />
          <Route route={MAP_ROUTE} element={<Map />} />
        </Routes>
      </main>
    </div>
  );
};

const Home = () => {
  return <Box>🏠 Homepage</Box>;
};

const Map = () => {
  return (
    <Box>
      <TabList>
        <Tab route={MAP_TAB_A_ROUTE}>Users</Tab>
        <Tab route={MAP_TAB_B_ROUTE}>Settings</Tab>
      </TabList>

      <Routes>
        <Route route={MAP_TAB_A_ROUTE} element={<Box>Tab A content</Box>} />
        <Route route={MAP_TAB_B_ROUTE} element={<Box>Tab B content</Box>} />
      </Routes>
    </Box>
  );
};

render(<App />, document.querySelector("#root"));
