/**
 * Navigation Index Demo
 *
 * This demo tests different scenarios with index routes and nested navigation:
 *
 * Test Case 1: Simple top-level navigation between Home and Map
 *
 * Test Case 2: Multi-level nested index routes with <Route.Slot />
 *   - /map auto-redirects to Users tab (index route)
 *   - /map/tab_a auto-redirects to Walk sub-tab (nested index route)
 *   - Uses <Route.Slot /> pattern for nested route rendering
 *
 * Test Case 3: Non-index route with nested routes using <Routes>
 *   - Settings tab is NOT index, requires manual navigation
 *   - Uses <Routes> instead of <Route.Slot /> for nested structure
 *
 * Test Case 4: Index route without <Route.Slot />
 *   - Profile tab is marked as index but uses <Routes> for nested routes
 *   - Tests index behavior when not using slot pattern
 */

import { Box, Route, Routes, setupRoutes, Tab, TabList } from "@jsenv/navi";
import { render } from "preact";

const {
  HOME_ROUTE,
  MAP_ROUTE,
  MAP_TAB_A_ROUTE,
  MAP_TAB_B_ROUTE,
  MAP_TAB_C_ROUTE,
  MAP_TAB_A_WALK_ROUTE,
  MAP_TAB_A_TRANSIT_ROUTE,
  MAP_TAB_B_WALK_ROUTE,
  MAP_TAB_B_TRANSIT_ROUTE,
  MAP_TAB_C_WALK_ROUTE,
  MAP_TAB_C_TRANSIT_ROUTE,
} = setupRoutes({
  HOME_ROUTE: "home",
  MAP_ROUTE: "map{/}?*",
  MAP_TAB_A_ROUTE: "map/tab_a{/}?*",
  MAP_TAB_B_ROUTE: "map/tab_b{/}?*",
  MAP_TAB_C_ROUTE: "map/tab_c{/}?*",
  MAP_TAB_A_WALK_ROUTE: "map/tab_a/walk",
  MAP_TAB_A_TRANSIT_ROUTE: "map/tab_a/transit",
  MAP_TAB_B_WALK_ROUTE: "map/tab_b/walk",
  MAP_TAB_B_TRANSIT_ROUTE: "map/tab_b/transit",
  MAP_TAB_C_WALK_ROUTE: "map/tab_c/walk",
  MAP_TAB_C_TRANSIT_ROUTE: "map/tab_c/transit",
});

const App = () => {
  return (
    <div>
      {/* Test Case 1: Simple top-level navigation */}
      <TabList underline>
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
      <TabList underline>
        <Tab route={MAP_TAB_A_ROUTE}>Users (nested index with slot)</Tab>
        <Tab route={MAP_TAB_B_ROUTE}>
          Settings (non-index with nested routes)
        </Tab>
        <Tab route={MAP_TAB_C_ROUTE}>Profile (index without slot)</Tab>
      </TabList>
      <Routes>
        {/* Test Case 2: Index route with nested index using <Route.Slot />
            - MAP_TAB_A_ROUTE is marked as index, so /map auto-redirects here
            - MAP_TAB_A_WALK_ROUTE is marked as index, so /map/tab_a auto-redirects to /map/tab_a/walk
            - Tests multi-level nested index auto-navigation with slot pattern */}
        <Route
          index
          route={MAP_TAB_A_ROUTE}
          element={
            <Box>
              Users Tab Content
              <TabList underline>
                <Tab route={MAP_TAB_A_WALK_ROUTE}>Walk</Tab>
                <Tab route={MAP_TAB_A_TRANSIT_ROUTE}>Transit</Tab>
              </TabList>
              <Route.Slot />
            </Box>
          }
        >
          <Route index route={MAP_TAB_A_WALK_ROUTE} element="Walk content" />
          <Route route={MAP_TAB_A_TRANSIT_ROUTE} element="Transit content" />
        </Route>

        {/* Test Case 3: Non-index route with nested routes using <Routes>
            - MAP_TAB_B_ROUTE is NOT marked as index, so it won't auto-redirect
            - Has nested routes but uses <Routes> instead of <Route.Slot />
            - Tests manual navigation to non-index tab with nested structure */}
        <Route
          route={MAP_TAB_B_ROUTE}
          element={
            <Box>
              Settings Tab Content
              <TabList underline>
                <Tab route={MAP_TAB_B_WALK_ROUTE}>Walk Settings</Tab>
                <Tab route={MAP_TAB_B_TRANSIT_ROUTE}>Transit Settings</Tab>
              </TabList>
              <Routes>
                <Route
                  index
                  route={MAP_TAB_B_WALK_ROUTE}
                  element="Walk settings content"
                />
                <Route
                  route={MAP_TAB_B_TRANSIT_ROUTE}
                  element="Transit settings content"
                />
              </Routes>
            </Box>
          }
        />

        {/* Test Case 4: Index route without <Route.Slot /> 
            - MAP_TAB_C_ROUTE is marked as index (though Users tab is also index, this tests fallback behavior)
            - Uses <Routes> for nested routes instead of <Route.Slot />
            - Tests index route behavior when not using slot pattern */}
        <Route
          index
          route={MAP_TAB_C_ROUTE}
          element={
            <Box>
              Profile Tab Content
              <TabList underline>
                <Tab route={MAP_TAB_C_WALK_ROUTE}>Walk Profile</Tab>
                <Tab route={MAP_TAB_C_TRANSIT_ROUTE}>Transit Profile</Tab>
              </TabList>
              <Routes>
                <Route
                  index
                  route={MAP_TAB_C_WALK_ROUTE}
                  element="Walk profile content"
                />
                <Route
                  route={MAP_TAB_C_TRANSIT_ROUTE}
                  element="Transit profile content"
                />
              </Routes>
            </Box>
          }
        />
      </Routes>
    </Box>
  );
};

render(<App />, document.querySelector("#root"));
