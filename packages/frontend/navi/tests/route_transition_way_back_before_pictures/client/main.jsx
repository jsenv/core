/*
 * Two pages and a default slide between them. `window.goDetail()` presses the
 * link to the detail, `window.goHome()` asks for the way back.
 *
 * `window.holdCallbackMs`, when set, keeps every view transition's update
 * callback pending that long once navi's part of it is done: the browser
 * waiting for the page arriving to render, the page being left frozen on
 * screen meanwhile.
 *
 * Reported: the movements the document wore (type and way round), and for
 * each view transition started whether it played.
 */

import {
  defineRouteDefaultTransition,
  navTo,
  Route,
  route,
  RouteTransitionArea,
  setupRoutes,
  whenPageAtRest,
} from "@jsenv/navi";
import { render } from "preact";

const HOME_ROUTE = route("");
const DETAIL_ROUTE = route("/detail");
setupRoutes([HOME_ROUTE, DETAIL_ROUTE]);
defineRouteDefaultTransition({
  type: "slide-x",
  direction: "history",
  duration: 400,
});

const HomePage = () => (
  <div className="home_page" style={{ height: "400px" }}>
    home
  </div>
);
const DetailPage = () => (
  <div className="detail_page" style={{ height: "400px" }}>
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
window.goDetail = () => navTo(DETAIL_ROUTE.buildUrl());
window.goHome = (options) => navTo(HOME_ROUTE.buildUrl(), options);
window.movements = [];
new MutationObserver(() => {
  const html = document.documentElement;
  const direction = html.getAttribute("data-navi-route-transition");
  const movement =
    direction === null
      ? "none"
      : `${html.getAttribute("data-navi-route-transition-type")} ${direction}`;
  if (window.movements[window.movements.length - 1] !== movement) {
    window.movements.push(movement);
  }
}).observe(document.documentElement, { attributes: true });
window.viewTransitions = [];
const startViewTransition = document.startViewTransition.bind(document);
document.startViewTransition = (callback) => {
  const record = { played: false, awaitingPage: false };
  window.viewTransitions.push(record);
  const viewTransition = startViewTransition(async () => {
    await callback();
    record.awaitingPage = true;
    if (window.holdCallbackMs) {
      await new Promise((resolve) => {
        setTimeout(resolve, window.holdCallbackMs);
      });
    }
  });
  viewTransition.ready.then(
    () => {
      record.played = true;
    },
    () => {},
  );
  return viewTransition;
};
render(<App />, document.querySelector("#app"));
