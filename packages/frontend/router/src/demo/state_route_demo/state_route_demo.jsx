import {
  registerRoute,
  Route,
  useRouteData,
  useRouteIsMatching,
  useRouteLoadingState,
  useRouteUrl,
} from "@jsenv/router";
import { render } from "preact";

const ROOT_ROUTE = registerRoute("/", () => "root content");
const A_ROUTE = registerRoute("/a", () => "a content");
const B_ROUTE = registerRoute("/b", () => "b content");

const MENU_ROUTE = registerRoute({
  match: (state) => {
    return state.menu_opened === true;
  },
  enter: (state) => {
    state.menu_opened = true;
  },
  leave: (state) => {
    state.menu_opened = false;
  },
  load: () => "menu content",
  name: "menu",
});

const App = () => {
  const rootUrl = useRouteUrl(ROOT_ROUTE);
  const aUrl = useRouteUrl(A_ROUTE);
  const bUrl = useRouteUrl(B_ROUTE);

  const links = [
    {
      url: rootUrl,
      text: "root",
    },
    {
      url: aUrl,
      text: "a",
    },
    {
      url: bUrl,
      text: "b",
    },
  ];

  const menuIsOpened = useRouteIsMatching(MENU_ROUTE);

  return (
    <div>
      <h1>Navigation</h1>
      <nav style="display: flex; gap: 0px">
        {links.map((link, index) => {
          return (
            <div
              key={index}
              style="display: flex; flex-direction: column; width: 200px"
            >
              <a
                href={link.url}
                style={{
                  padding: "10px",
                  border: "1px solid black",
                }}
              >
                {link.text}
              </a>
            </div>
          );
        })}
      </nav>

      <h1>Content</h1>
      <aside>
        <details
          onToggle={(e) => {
            if (e.target.open) {
              MENU_ROUTE.enter();
            } else {
              MENU_ROUTE.leave();
            }
          }}
          open={menuIsOpened}
        >
          <summary>Menu</summary>
          <Route route={MENU_ROUTE} loading={Loading} loaded={RouteDisplay} />
        </details>
      </aside>
      <main style="padding: 10px; border: 1px solid black; margin-top: 10px">
        <div>
          <button onClick={MENU_ROUTE.enter}>Open menu</button>
          <button onClick={MENU_ROUTE.leave}>Close menu</button>
        </div>

        <Route route={ROOT_ROUTE} loading={Loading} loaded={RouteDisplay} />
        <Route route={A_ROUTE} loading={Loading} loaded={RouteDisplay} />
        <Route route={B_ROUTE} loading={Loading} loaded={RouteDisplay} />
      </main>
    </div>
  );
};

const Loading = () => {
  return "loading...";
};
const RouteDisplay = ({ route }) => {
  const readyState = useRouteLoadingState(route);
  const data = useRouteData(route);
  return (
    <div>
      page state: {readyState}
      <br />
      page data: {data}
    </div>
  );
};

render(<App />, document.getElementById("root"));
