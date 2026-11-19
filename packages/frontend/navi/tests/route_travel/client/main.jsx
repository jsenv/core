/*
 * A RouteTravel row over a long list, read by a window of five pages around
 * the one on screen (the shape of src/nav/demos/route_travel/route_travel_window.html):
 * pages /item/0 to /item/39, each the live page or a neighbour drawn by
 * `renderNeighbour`, and a bar whose ‹ › replace the address with the page
 * next door.
 */

import {
  createAction,
  Link,
  Route,
  route,
  routeAction,
  RouteTravel,
  routeTravelSettledPageSignal,
  setupRoutes,
  useAsyncData,
  whenPageAtRest,
} from "@jsenv/navi";
import { render } from "preact";
import { useLayoutEffect } from "preact/hooks";

const ITEM_ROUTE = route("/item/:id");
setupRoutes([ITEM_ROUTE]);
const COLORS = ["#e8f0fe", "#fdf0e8", "#eaf7ec", "#f3e8fe", "#fee8ee"];
const COUNT = 40;
const pageOf = (id) => ({ route: ITEM_ROUTE, params: { id: String(id) } });

const ITEM_ACTION = routeAction(
  ITEM_ROUTE,
  createAction(async ({ id }) => {
    await new Promise((resolve) => setTimeout(resolve, 100));
    return Array.from({ length: 30 }, (_, i) => `Item ${id}, line ${i}`);
  }),
  () => ({ id: ITEM_ROUTE.paramsSignal.value.id }),
);

const Item = () => {
  const id = Number(ITEM_ROUTE.paramsSignal.value.id);
  const [lines, loading] = useAsyncData(ITEM_ACTION, { loading: true });
  const color = COLORS[id % COLORS.length];
  if (loading || !lines) {
    return (
      <div className="card" style={{ background: color }}>
        Item {id}…
      </div>
    );
  }
  return lines.map((line) => (
    <div key={line} className="card" style={{ background: color }}>
      {line}
    </div>
  ));
};

const ItemSkeleton = ({ id }) => (
  <div style={{ flex: 1, background: COLORS[id % COLORS.length] }}>
    <div className="card">Item {id}…</div>
  </div>
);

const Bar = ({ id }) => {
  const settled = routeTravelSettledPageSignal.value;
  const shown = settled ? Number(settled.params.id) : id;
  return (
    <div className="bar">
      <Link
        id="previous"
        route={ITEM_ROUTE}
        routeParams={{ id: String(shown - 1) }}
        replace
      >
        ‹
      </Link>
      <span id="counter" className="counter">
        {shown + 1}/{COUNT}
      </span>
      <Link
        id="next"
        route={ITEM_ROUTE}
        routeParams={{ id: String(shown + 1) }}
        replace
      >
        ›
      </Link>
    </div>
  );
};

const Page = () => {
  const id = Number(ITEM_ROUTE.paramsSignal.value.id);
  const pages = [];
  for (let i = id - 2; i <= id + 2; i++) {
    if (i >= 0 && i < COUNT) {
      pages.push(pageOf(i));
    }
  }
  return (
    <>
      <Bar id={id} />
      <RouteTravel
        className="box"
        routes={pages}
        renderNeighbour={(page) => <ItemSkeleton id={Number(page.params.id)} />}
      >
        <Item />
      </RouteTravel>
    </>
  );
};

const OpenFirst = () => {
  useLayoutEffect(() => {
    ITEM_ROUTE.redirectTo({ id: "5" });
  }, []);
  return null;
};

// What the suite waits on before reading the row (see browser_harness.mjs).
window.whenPageAtRest = whenPageAtRest;

render(
  <Route>
    <Route route={ITEM_ROUTE} element={Page} />
    <Route fallback element={OpenFirst} />
  </Route>,
  document.querySelector("#app"),
);
