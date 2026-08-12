/*
 * Three tabs on a single route, each selected by its params, and one route
 * action that has nothing to do on one of them (its params getter returns
 * false). The bars are siblings of <Route>, everything sits under <Loading>.
 */

import {
  createAction,
  Link,
  Loading,
  Nav,
  Route,
  route,
  routeAction,
  setupRoutes,
  stateSignal,
  useAsyncData,
} from "@jsenv/navi";
import { render } from "preact";

const sectionSignal = stateSignal("to_come", {
  id: "my_games_section",
  oneOf: ["candidate", "to_come", "done"],
  autoFix: true,
});
const HOME_ROUTE = route("");
const MY_GAMES_ROUTE = route(`/games/me/:section=${sectionSignal}`);
setupRoutes([HOME_ROUTE, MY_GAMES_ROUTE]);

const GAME_GET_MANY = createAction(
  async (params) => {
    await new Promise((resolve) => setTimeout(resolve, 50));
    return [`game for ${JSON.stringify(params)}`];
  },
  { name: "GAME.GET_MANY" },
);
const MY_GAMES_LIST_ACTION = routeAction(MY_GAMES_ROUTE, GAME_GET_MANY, () => {
  const section = sectionSignal.value;
  if (section === "candidate") {
    return { scope: "candidate" };
  }
  if (section === "to_come") {
    return {};
  }
  // the "done" section shows no list: the action goes to sleep
  return false;
});

const GamesSection = ({ label }) => {
  const [data] = useAsyncData(MY_GAMES_LIST_ACTION);

  return (
    <div id="section_body" data-section={label}>
      {`${label}: ${JSON.stringify(data)}`}
    </div>
  );
};
const CandidateGames = () => <GamesSection label="candidate" />;
const DoneGames = () => <GamesSection label="done" />;
const GamesToCome = () => <GamesSection label="to_come" />;
const HomePage = () => (
  <div id="section_body" data-section="home">
    home
  </div>
);

const AppLayout = ({ children }) => {
  return (
    <div id="main">
      <header id="top_bar">top bar</header>
      <Nav spacing="s">
        <Link route={MY_GAMES_ROUTE} routeParams={{ section: "candidate" }}>
          candidate
        </Link>
        <Link route={MY_GAMES_ROUTE} routeParams={{ section: "to_come" }}>
          to_come
        </Link>
        <Link route={MY_GAMES_ROUTE} routeParams={{ section: "done" }}>
          done
        </Link>
        <Link route={HOME_ROUTE}>home</Link>
      </Nav>
      {children}
      <footer id="bottom_bar">bottom bar</footer>
    </div>
  );
};

const App = () => {
  return (
    <Route element={AppLayout}>
      <Route route={HOME_ROUTE} element={HomePage} />
      <Route
        route={MY_GAMES_ROUTE}
        routeParams={{ section: "candidate" }}
        element={CandidateGames}
      />
      <Route
        route={MY_GAMES_ROUTE}
        routeParams={{ section: "done" }}
        element={DoneGames}
      />
      <Route
        route={MY_GAMES_ROUTE}
        routeParams={{ section: "to_come" }}
        element={GamesToCome}
      />
    </Route>
  );
};

render(
  <Loading fallback={<p id="loading_fallback">loading…</p>}>
    <App />
  </Loading>,
  document.getElementById("app"),
);
