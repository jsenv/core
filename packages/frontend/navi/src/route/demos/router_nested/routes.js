import { setupRoutes } from "@jsenv/navi";

export const { MAP_ROUTE, MAP_PANEL_A_ROUTE, MAP_PANEL_B_ROUTE } = setupRoutes({
  MAP_ROUTE: "map{/}?*",
  MAP_PANEL_A_ROUTE: "map/a",
  MAP_PANEL_B_ROUTE: "map/b",
});
