import {
  registerRoute,
  registerStateRoute,
  Route,
  useRouteData,
  useRouteIsMatching,
  useRouteLoadingState,
  useRouteUrl,
} from "@jsenv/router";
import { render } from "preact";

const useMenuRouteNav = (route) => {
  const open = () => {
    route.setState({ menu_opened: true });
  };

  const close = () => {
    route.setState({ menu_opened: false });
  };

  return [open, close];
};

const ROOT_ROUTE = registerRoute("/", () => "root content");
const A_ROUTE = registerRoute("/a", () => "a content");
const B_ROUTE = registerRoute("/b", () => "b content");

const MENU_ROUTE = registerStateRoute(
  { menu_opened: true },
  () => "menu content",
);

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
  const [openMenu, closeMenu] = useMenuRouteNav(MENU_ROUTE);
  console.log({ menuIsOpened, openMenu, closeMenu });

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
              openMenu();
            } else {
              closeMenu();
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
          <button onClick={openMenu}>Open menu</button>
          <button onClick={closeMenu}>Close menu</button>
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
