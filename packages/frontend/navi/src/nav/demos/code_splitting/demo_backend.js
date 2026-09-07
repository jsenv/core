import { resource, route, routeAction, setupRoutes } from "@jsenv/navi";

import { createFakeBackend } from "../../../internal/fake_backend.jsx";

export const backend = createFakeBackend({
  value: [
    { id: "1", name: "Partie du mardi", players: 4 },
    { id: "2", name: "Tournoi", players: 12 },
  ],
});

export const HOME_ROUTE = route("");
export const GAME_ROUTE = route("/games/:gameId");
export const STATS_ROUTE = route("/stats");
setupRoutes([HOME_ROUTE, GAME_ROUTE, STATS_ROUTE]);

export const GAME = resource("game", {
  GET: ({ gameId }) =>
    backend.call(`GET /games/${gameId}`, () => {
      const game = backend.valueSignal.peek().find((row) => row.id === gameId);
      if (!game) {
        throw new Error(`no game ${gameId}`);
      }
      return game;
    }),
});
export const GAME_PAGE_ACTION = routeAction(GAME_ROUTE, GAME.GET, () => ({
  gameId: GAME_ROUTE.paramsSignal.value.gameId,
}));

// The code of a page is one more thing its address asks for. Each import goes
// through the backend so it can be watched on the frontier, next to the data.
// The page imports this module back for its route action: a dynamic import is
// not a load-order cycle, the page module only exists once this one has run.
export const GAME_PAGE_CODE = routeAction(GAME_ROUTE, () =>
  backend
    // eslint-disable-next-line import-x/no-cycle
    .call("import ./game_page.jsx", () => import("./game_page.jsx"))
    .then((m) => m.GamePage),
);
export const STATS_PAGE_CODE = routeAction(STATS_ROUTE, () =>
  backend
    .call("import ./stats_page.jsx", () => import("./stats_page.jsx"))
    .then((m) => m.StatsPage),
);
