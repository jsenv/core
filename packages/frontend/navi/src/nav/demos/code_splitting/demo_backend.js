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
