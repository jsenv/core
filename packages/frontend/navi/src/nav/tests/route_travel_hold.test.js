import { snapshotTests } from "@jsenv/snapshot";

import { route, setupRoutes } from "../route.js";
import { setBaseUrl } from "../route_pattern.js";
import {
  followPageOnScreen,
  holdPage,
  readHeldLinkCurrent,
  releaseHeldPage,
  routeTravelSettledPageSignal,
} from "../route_travel_hold.js";

setBaseUrl("http://localhost:3000");

// Two rows on one page: the games of a profile, and the tabs of a game shown
// in it. Each row holds and lets go of its own page.
await snapshotTests(import.meta.url, ({ test }) => {
  test("a row letting go leaves the hold of another row alone", () => {
    const GAME_ROUTE = route("/games/:gameId");
    const TAB_ROUTE = route("/tabs/:tab");
    const { clearRoutes } = setupRoutes([GAME_ROUTE, TAB_ROUTE]);
    const gameRow = { name: "game row" };
    const tabRow = { name: "tab row" };
    const game = (gameId) => ({ route: GAME_ROUTE, params: { gameId } });
    const tab = (name) => ({ route: TAB_ROUTE, params: { tab: name } });
    const read = () => ({
      settled: routeTravelSettledPageSignal.value?.params ?? null,
      game_a_current: readHeldLinkCurrent(GAME_ROUTE, { gameId: "a" }),
      game_b_current: readHeldLinkCurrent(GAME_ROUTE, { gameId: "b" }),
      tab_info_current: readHeldLinkCurrent(TAB_ROUTE, { tab: "info" }),
      tab_score_current: readHeldLinkCurrent(TAB_ROUTE, { tab: "score" }),
    });
    try {
      // a hand pulls the games from a toward b, the address running ahead
      holdPage(gameRow, game("a"), game("b"));
      const gameRowHeld = read();
      // meanwhile the tabs row moves from info toward score on a trackpad
      followPageOnScreen(tabRow, tab("info"), tab("score"));
      const bothHeld = read();
      // the tabs row comes to rest
      releaseHeldPage(tabRow);
      const tabRowAtRest = read();
      // a row that holds nothing letting go changes nothing
      releaseHeldPage(tabRow);
      const tabRowAtRestAgain = read();
      // the games row comes to rest
      releaseHeldPage(gameRow);
      const bothAtRest = read();
      return {
        game_row_held: gameRowHeld,
        both_held: bothHeld,
        tab_row_at_rest: tabRowAtRest,
        tab_row_at_rest_again: tabRowAtRestAgain,
        both_at_rest: bothAtRest,
      };
    } finally {
      releaseHeldPage(gameRow);
      releaseHeldPage(tabRow);
      clearRoutes();
    }
  });

  test("the page held stays the one the hand set off from", () => {
    const GAME_ROUTE = route("/games/:gameId");
    const { clearRoutes } = setupRoutes([GAME_ROUTE]);
    const row = { name: "row" };
    const game = (gameId) => ({ route: GAME_ROUTE, params: { gameId } });
    try {
      holdPage(row, game("a"), game("b"));
      holdPage(row, game("b"), game("c"));
      return {
        settled: routeTravelSettledPageSignal.value.params,
        game_a_current: readHeldLinkCurrent(GAME_ROUTE, { gameId: "a" }),
        game_c_current: readHeldLinkCurrent(GAME_ROUTE, { gameId: "c" }),
      };
    } finally {
      releaseHeldPage(row);
      clearRoutes();
    }
  });
});
