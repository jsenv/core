/*
 * Two pages, a link from the first to the second, and what says how the way
 * between them plays — chosen by `?source=`:
 * - "default": the default every push takes, ordered by history;
 * - "written": a relation written for this very way;
 * - "request": nothing defined, the link asks for a movement itself;
 * - "anywhere": the second page reached from anywhere.
 *
 * What it reports: every movement the document wears (type and way round), and
 * how many history entries were written.
 */

import {
  defineRouteDefaultTransition,
  defineRouteTransition,
  Link,
  Route,
  route,
  RouteTransitionArea,
  setupRoutes,
  whenPageAtRest,
} from "@jsenv/navi";
import { render } from "preact";

const source = new URL(window.location.href).searchParams.get("source");
const HOME_ROUTE = route("");
const DETAIL_ROUTE = route("/detail");
setupRoutes([HOME_ROUTE, DETAIL_ROUTE]);
if (source === "default") {
  defineRouteDefaultTransition({ type: "slide-x", direction: "history" });
} else if (source === "written") {
  defineRouteTransition(HOME_ROUTE, DETAIL_ROUTE, "cover-bottom");
} else if (source === "anywhere") {
  defineRouteTransition(null, DETAIL_ROUTE, "cover-bottom");
}

const HomePage = () => (
  <div id="home_page" style={{ height: "400px" }}>
    <Link
      id="to_detail"
      route={DETAIL_ROUTE}
      routeTransition={source === "request" ? "cover-right" : undefined}
    >
      detail
    </Link>
  </div>
);
const DetailPage = () => (
  <div id="detail_page" style={{ height: "400px" }}>
    detail
  </div>
);
const App = () => (
  <RouteTransitionArea>
    <Route>
      <Route route={HOME_ROUTE} element={HomePage} />
      <Route route={DETAIL_ROUTE} element={DetailPage} />
    </Route>
  </RouteTransitionArea>
);

window.whenPageAtRest = whenPageAtRest;
window.movements = [];
new MutationObserver(() => {
  const html = document.documentElement;
  const direction = html.getAttribute("data-navi-route-transition");
  if (direction === null) {
    return;
  }
  const movement = `${html.getAttribute("data-navi-route-transition-type")} ${direction}`;
  if (window.movements[window.movements.length - 1] !== movement) {
    window.movements.push(movement);
  }
}).observe(document.documentElement, { attributes: true });
window.historyWrites = 0;
for (const method of ["pushState", "replaceState"]) {
  const write = window.history[method].bind(window.history);
  window.history[method] = (...args) => {
    window.historyWrites++;
    return write(...args);
  };
}
render(<App />, document.querySelector("#app"));
