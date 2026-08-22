/*
 * The decor a report from an application described, rebuilt whole — it is not
 * the one next door (app.jsx), and the differences are the point:
 *
 * - ONE row in the collection. Nothing is virtualized away, no window ever has
 *   to move, and the run stands for its whole collection from the first frame.
 * - `scroller="document"`: the page scrolls, the list has no box of its own.
 * - `defaultScrolled="end"`: the list opens on its last rows, said as a string
 *   — a hold with no row to name.
 * - `count` known BEFORE any row is drawn: the list is not rendered at all
 *   until the profile has answered, so on every revisit the count is there and
 *   nothing is located yet.
 *
 * Mounted twice, with and without a relation on the pair.
 */

import {
  defineRouteTransition,
  Link,
  List,
  Loading,
  NaviDebug,
  resource,
  Route,
  route,
  RouteTransitionArea,
  setupRoutes,
  useAsyncData,
  createAction,
} from "@jsenv/navi";
import { signal } from "@preact/signals";
import { render } from "preact";

const ROWS = [{ id: "game_1", label: "Padel des Cèdres", day: "2026-08-22" }];

// Where the reading position is written down, the way the application does it:
// a signal fed by every position the list reports.
const atSignal = signal(undefined);

export const start = ({ transition }) => {
  const LIST_ROUTE = route("");
  const ITEM_ROUTE = route("/item/:itemId");
  setupRoutes([LIST_ROUTE, ITEM_ROUTE]);
  if (transition) {
    defineRouteTransition(LIST_ROUTE, ITEM_ROUTE, "slide-x");
  }

  window.rangeCalls = [];
  // This decor has no GET_MANY list; the counter exists so both decors are
  // read the same way.
  window.manyCalls = [];
  window.requestStates = [];

  const GAME = resource("game", {
    GET_RANGE: ({ start, end }) => {
      window.rangeCalls.push({ start, end });
      return { items: ROWS, start: 0, count: ROWS.length };
    },
  });

  // The profile: how many rows the list stands for, known from elsewhere and
  // already answered by the time the user comes back.
  const PROFILE = createAction(
    async () => {
      await new Promise((resolve) => setTimeout(resolve, 20));
      return { my_games_count: ROWS.length };
    },
    { name: "PROFILE.GET" },
  );

  // The list decides where it opens at mount, and can only decide it knowing
  // the count: it is not rendered at all until the profile has answered.
  const Thread = ({ count, goTo }) => (
    <List
      className="day-thread"
      scroller="document"
      defaultScrolled="end"
      scrolled={goTo}
      hoverWhileScrolling
      onScrolledChange={(scrolled) => {
        atSignal.value = scrolled?.id || undefined;
      }}
      spacing="s"
      border="none"
    >
      <List.Items
        count={count}
        itemsAction={GAME.GET_RANGE.bindParams({ scope: "thread" })}
        onRequestStateChange={(state) => {
          window.requestStates.push(state);
        }}
        groupBy={(item) => item.day}
        renderGroupLabel={(item) => item.day}
        renderSkeleton={(index) => (
          <List.Item skeleton>{`row ${index}`}</List.Item>
        )}
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
  );

  const ListPage = () => {
    const [profile] = useAsyncData(PROFILE);
    return (
      <div id="list_page" className="page">
        {profile ? <Thread count={profile.my_games_count} /> : null}
      </div>
    );
  };
  const ItemPage = () => (
    <div id="item_page" className="page">
      detail
    </div>
  );

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
  window.scrollLog = [];
  render(
    <NaviDebug debugScroll={(...args) => window.scrollLog.push(args.join(" "))}>
      <Loading fallback={<p id="loading_fallback">loading…</p>}>
        <App />
      </Loading>
    </NaviDebug>,
    document.getElementById("app"),
  );
  PROFILE.run({ reason: "app started" });
};
