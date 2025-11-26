import { Route, RouteLink, Routes, setupRoutes } from "@jsenv/navi";
import "preact/debug";

const { MAP_ROUTE, MAP_PANEL_A_ROUTE, MAP_PANEL_B_ROUTE } = setupRoutes({
  MAP_ROUTE: "map/*?",
  MAP_PANEL_A_ROUTE: "map/a",
  MAP_PANEL_B_ROUTE: "map/b",
});

const Router = () => {
  return (
    <Routes>
      <Route route={MAP_ROUTE} element={<Map />}></Route>
    </Routes>
  );
};

const MapPanelA = () => {
  return <span id="panel_a">panel a</span>;
};
const MapPanelB = () => {
  return <span id="panel_b">panel b</span>;
};

const Map = () => {
  return (
    <div id="map">
      <aside>
        <nav>
          <RouteLink route={MAP_PANEL_A_ROUTE}>Map panel A</RouteLink>
          <RouteLink route={MAP_PANEL_B_ROUTE}>Map panel B</RouteLink>
        </nav>
      </aside>
      <section>
        <Routes>
          <Route route={MAP_PANEL_A_ROUTE} element={<MapPanelA />} />
          <Route route={MAP_PANEL_B_ROUTE} element={<MapPanelB />} />
        </Routes>
        🗺️ Map
      </section>
    </div>
  );
};

export const App = () => {
  return (
    <div id="app">
      <h1>Double Nesting Route Test</h1>

      <div className="nav">
        <RouteLink route={MAP_ROUTE}>Map</RouteLink>
      </div>

      <main>
        <Router />
      </main>
    </div>
  );
};
