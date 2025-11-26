import { Box, Route, RouteLink, Routes } from "@jsenv/navi";
import { Mapbox } from "./mapbox.jsx";
import { MAP_PANEL_A_ROUTE, MAP_PANEL_B_ROUTE } from "./routes.js";

export const Map = () => {
  return (
    <div id="map">
      <aside>
        <nav>
          <RouteLink route={MAP_PANEL_A_ROUTE}>Map panel A</RouteLink>
          <RouteLink route={MAP_PANEL_B_ROUTE}>Map panel B</RouteLink>
        </nav>
      </aside>
      <Box as="section">
        <Routes>
          <Route route={MAP_PANEL_A_ROUTE} element={<MapPanelA />} />
          <Route route={MAP_PANEL_B_ROUTE} element={<MapPanelB />} />
        </Routes>
        <Mapbox />
      </Box>
    </div>
  );
};

const MapPanelA = () => {
  return <span id="panel_a">panel a</span>;
};
const MapPanelB = () => {
  return <span id="panel_b">panel b</span>;
};
