/*
 * A nav of three tabs, and two rows of routes said to move the way a
 * RouteTravel says it (route_row_follow.js): the tabs row, whose pages are the
 * nav's tabs, and a row of games, whose pages are none of them.
 *
 * `window.moveRow(name, move)` publishes a move of the row named, `null` once
 * it stopped; `window.readNav()` says whether the nav follows a row and how far.
 */

import { Link, Nav, route, setupRoutes } from "@jsenv/navi";
import { publishRouteRowMove } from "@jsenv/navi/src/nav/route_row_follow.js";
import { render } from "preact";

const TAB_ROUTE = route("/tabs/:tab");
const GAME_ROUTE = route("/games/:gameId");
setupRoutes([TAB_ROUTE, GAME_ROUTE]);
const pageOf = {
  info: { route: TAB_ROUTE, params: { tab: "info" } },
  score: { route: TAB_ROUTE, params: { tab: "score" } },
  game_a: { route: GAME_ROUTE, params: { gameId: "a" } },
  game_b: { route: GAME_ROUTE, params: { gameId: "b" } },
};
const rows = { tabs: { name: "tabs" }, games: { name: "games" } };

const App = () => (
  <Nav id="tabs_nav" currentIndicator>
    <Link route={TAB_ROUTE} routeParams={{ tab: "info" }}>
      info
    </Link>
    <Link route={TAB_ROUTE} routeParams={{ tab: "score" }}>
      score
    </Link>
    <Link route={TAB_ROUTE} routeParams={{ tab: "stats" }}>
      stats
    </Link>
  </Nav>
);

window.moveRow = (rowName, move) => {
  publishRouteRowMove(
    rows[rowName],
    move
      ? {
          basePage: pageOf[move.base],
          towardPage: move.toward ? pageOf[move.toward] : null,
          progress: move.progress,
        }
      : null,
  );
};
window.readNav = () => {
  const navElement = document.querySelector("#tabs_nav");
  return {
    following: navElement.hasAttribute("data-nav-following-row"),
    progress:
      navElement.style.getPropertyValue("--slide-travel-progress") || null,
  };
};
render(<App />, document.querySelector("#app"));
