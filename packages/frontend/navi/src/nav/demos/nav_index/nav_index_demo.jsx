import { Box, Route, Routes, setupRoutes, Tab, TabList } from "@jsenv/navi";
import { render } from "preact";

const {
  HOME_ROUTE,
  MAP_ROUTE,
  MAP_TAB_A_ROUTE,
  MAP_TAB_B_ROUTE,
  MAP_TAB_A_WALK_ROUTE,
  MAP_TAB_A_TRANSIT_ROUTE,
  MAP_TAB_B_WALK_ROUTE,
  MAP_TAB_B_TRANSIT_ROUTE,
} = setupRoutes({
  HOME_ROUTE: "home",
  MAP_ROUTE: "map{/}?*",
  MAP_TAB_A_ROUTE: "map/tab_a{/}?*",
  MAP_TAB_B_ROUTE: "map/tab_b{/}?*",
  MAP_TAB_A_WALK_ROUTE: "map/tab_a/walk",
  MAP_TAB_A_TRANSIT_ROUTE: "map/tab_a/transit",
  MAP_TAB_B_WALK_ROUTE: "map/tab_b/walk",
  MAP_TAB_B_TRANSIT_ROUTE: "map/tab_b/transit",
});

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
  return <Box>Home content</Box>;
};

const Map = () => {
  return (
    <Box>
      Map content
      <TabList>
        <Tab route={MAP_TAB_A_ROUTE}>Users</Tab>
        <Tab route={MAP_TAB_B_ROUTE}>Settings</Tab>
      </TabList>
      <Routes>
        <Route
          index
          route={MAP_TAB_A_ROUTE}
          element={
            <Box>
              Tab A content
              <TabList>
                <Tab route={MAP_TAB_A_WALK_ROUTE}>Walk</Tab>
                <Tab route={MAP_TAB_A_TRANSIT_ROUTE}>Transit</Tab>
              </TabList>
              <Route.Slot />
            </Box>
          }
        >
          <Route index route={MAP_TAB_A_WALK_ROUTE} element="Walk" />
          <Route route={MAP_TAB_A_TRANSIT_ROUTE} element="Transit" />
        </Route>
        <Route
          route={MAP_TAB_B_ROUTE}
          element={
            <Box>
              Tab B content
              <TabList>
                <Tab route={MAP_TAB_B_WALK_ROUTE}>Walk</Tab>
                <Tab route={MAP_TAB_B_TRANSIT_ROUTE}>Transit</Tab>
              </TabList>
              <Route.Slot />
            </Box>
          }
        />
      </Routes>
    </Box>
  );
};

render(<App />, document.querySelector("#root"));
