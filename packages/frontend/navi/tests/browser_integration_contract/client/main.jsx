/*
 * One app, driven the same way under both browser integrations — the page sets
 * `globalThis.__NAVI_BROWSER_INTEGRATION__` ("history" or "navigation") before
 * navi loads: what each navigation leaves in the history — the address, the
 * entries, navi's depth — and whether it was announced.
 *
 * Pages: home (""), /a, /b, and /to_home, which redirects to home. A popup-like
 * sheet keeps its open state in the entry (useNavState, push). A link to /b is
 * wrapped in an element that cancels every click in the bubble phase.
 */

import {
  Link,
  navIntegratedVia,
  reload,
  Route,
  route,
  setupRoutes,
  useNavState,
  whenPageAtRest,
} from "@jsenv/navi";
import { render } from "preact";

import {
  observeAfterRouting,
  observeBeforeRouting,
} from "../../../src/nav/browser_integration/before_routing.js";
import { getNavDepth } from "../../../src/nav/browser_integration/document_back_and_forward.js";

const HOME_ROUTE = route("");
const A_ROUTE = route("/a");
const B_ROUTE = route("/b");
const TO_HOME_ROUTE = route("/to_home", { redirectRoute: HOME_ROUTE });
setupRoutes([HOME_ROUTE, A_ROUTE, B_ROUTE, TO_HOME_ROUTE]);

window.announced = { before: 0, after: 0 };
observeBeforeRouting(() => {
  window.announced.before++;
});
observeAfterRouting(() => {
  window.announced.after++;
});
window.whenPageAtRest = whenPageAtRest;
window.reloadRoutes = () => reload();
window.integration = navIntegratedVia;
// navi's depth, whichever integration keeps it (history.state is the history
// integration's own place for it).
window.readNavDepth = getNavDepth;

const Sheet = () => {
  const [open, enter, leave] = useNavState("contract_sheet", {
    type: "push",
  });
  return (
    <div>
      <button id="open_sheet" onClick={() => enter()}>
        open sheet
      </button>
      {open ? (
        <div id="sheet">
          sheet
          <button id="confirm_sheet" onClick={() => leave()}>
            confirm
          </button>
        </div>
      ) : null}
    </div>
  );
};

const Page = ({ name }) => (
  <div id={`page_${name}`}>
    {name}
    <nav>
      <Link id="link_home" route={HOME_ROUTE}>
        home
      </Link>
      <Link id="link_a" route={A_ROUTE}>
        a
      </Link>
      <Link id="link_b" route={B_ROUTE}>
        b
      </Link>
      <Link id="link_b_replace" route={B_ROUTE} replace>
        b (replace)
      </Link>
      <Link id="link_to_home" route={TO_HOME_ROUTE}>
        to home
      </Link>
      <a id="link_fragment" href="#section">
        section
      </a>
      <span
        onClick={(event) => {
          event.preventDefault();
        }}
      >
        <Link id="link_b_cancelled" route={B_ROUTE}>
          b (cancelled by its ancestor)
        </Link>
      </span>
    </nav>
    <Sheet />
    <div id="section">section</div>
  </div>
);

const HomePage = () => <Page name="home" />;
const APage = () => <Page name="a" />;
const BPage = () => <Page name="b" />;

const App = () => (
  <>
    <Route route={HOME_ROUTE} element={HomePage} />
    <Route route={A_ROUTE} element={APage} />
    <Route route={B_ROUTE} element={BPage} />
  </>
);

render(<App />, document.getElementById("app"));
