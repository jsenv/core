/*
 * Two ways of reading the same collection, on a list one leaves and comes back
 * to — and the question of who decides that the page asks again.
 *
 * - a `routeAction` over `GET_MANY`: the action keeps its response, so coming
 *   back has nothing to ask for. A page wanting fresh rows says `.rerun()`.
 * - a `<List.Items>` over `GET_RANGE`: the reader keeps the collection's
 *   composition and nothing else, so coming back draws the ranks it left AND
 *   asks for the window again (see resource_range_reader.js).
 *
 * Neither answer belongs to the navigation: the SOURCE decides. That is what
 * the test around this file holds, by mounting the same app twice — once with
 * a route transition defined on the pair, once without.
 */

import {
  createAction,
  defineRouteTransition,
  Link,
  List,
  Loading,
  resource,
  Route,
  route,
  routeAction,
  RouteTransitionArea,
  setupRoutes,
  useAsyncData,
} from "@jsenv/navi";
import { render } from "preact";

// Long enough for the list to hold rows it does not draw: a run standing for
// its whole collection would ask once and be done with it, and the window
// coming back is exactly what a revalidation is about.
const ITEMS = [];
let i = 0;
while (i < 500) {
  ITEMS.push({ id: `item_${i}`, label: `item ${i}` });
  i++;
}

export const start = ({ transition }) => {
  const LIST_ROUTE = route("");
  const ITEM_ROUTE = route("/item/:itemId");
  setupRoutes([LIST_ROUTE, ITEM_ROUTE]);
  if (transition) {
    defineRouteTransition(LIST_ROUTE, ITEM_ROUTE, "slide-x");
  }

  // Every ask that reaches the network, counted where the network would be.
  window.rangeCalls = [];
  window.manyCalls = [];

  const ITEM = resource("item", {
    GET_RANGE: ({ start, limit }) => {
      window.rangeCalls.push({ start, limit });
      const startNormalized = start < 0 ? ITEMS.length + start : start;
      return {
        items: ITEMS.slice(startNormalized, startNormalized + limit),
        start: startNormalized,
        count: ITEMS.length,
      };
    },
  });

  const THREAD_GET_MANY = createAction(
    async (params) => {
      window.manyCalls.push(params);
      await new Promise((resolve) => setTimeout(resolve, 20));
      return ITEMS.slice(0, 5);
    },
    { name: "THREAD.GET_MANY" },
  );
  const THREAD_ACTION = routeAction(LIST_ROUTE, THREAD_GET_MANY, () => ({
    scope: "thread",
  }));

  const ListPage = () => {
    const [threadData] = useAsyncData(THREAD_ACTION);
    return (
      <div
        id="list_page"
        className="page"
        data-thread={String(Boolean(threadData))}
      >
        <List renderBudget={30} renderBudgetSkipCheck>
          <List.Items
            count={ITEMS.length}
            itemsAction={ITEM.GET_RANGE.bindParams({ scope: "thread" })}
            renderItem={(item) => (
              <List.Item>
                <Link
                  data-testid="item_open"
                  route={ITEM_ROUTE}
                  routeParams={{ itemId: item.id }}
                >
                  {item.label}
                </Link>
              </List.Item>
            )}
          />
        </List>
      </div>
    );
  };
  const ItemPage = () => (
    <div id="item_page" className="page">
      detail
    </div>
  );

  // Pages living between fixed bars: the movement plays on the area's own
  // pictures. This is the shape a transition is usually defined in, and the
  // one where the arriving page is mounted inside the transition's callback,
  // with the document frozen.
  const AppLayout = ({ children }) => (
    <div className="shell">
      <header className="bar">top</header>
      <RouteTransitionArea className="area">{children}</RouteTransitionArea>
      <footer className="bar">bottom</footer>
    </div>
  );

  const App = () => (
    <Route element={AppLayout}>
      <Route route={LIST_ROUTE} element={ListPage} />
      <Route route={ITEM_ROUTE} element={ItemPage} />
    </Route>
  );
  render(
    <Loading fallback={<p id="loading_fallback">loading…</p>}>
      <App />
    </Loading>,
    document.getElementById("app"),
  );
};
