import { snapshotTests } from "@jsenv/snapshot";

import { globalSignalRegistry, stateSignal } from "../../state/state_signal.js";
import { route, setRouteIntegration, setupRoutes } from "../route.js";
import { setBaseUrl } from "../route_pattern.js";

const baseUrl = "http://localhost:3000";
setBaseUrl(baseUrl);

await snapshotTests(import.meta.url, ({ test }) => {
  test("weak search param is never inherited when building an url", () => {
    const editIdSignal = stateSignal(undefined, {
      id: "game_edit_id",
      type: "string",
      weak: true,
    });
    const filterSignal = stateSignal(undefined, {
      id: "game_filter",
      type: "string",
    });
    const GAME_CREATE = route("/games/create", {
      searchParams: { edit: editIdSignal, filter: filterSignal },
    });
    const { updateRoutes, clearRoutes } = setupRoutes([GAME_CREATE]);
    try {
      updateRoutes(`${baseUrl}/games/create?edit=W-ABC&filter=recent`);
      return {
        edit_signal: editIdSignal.value,
        filter_signal: filterSignal.value,
        // the link that does not ask for the edit mode must not get it
        url_without_params: GAME_CREATE.buildUrl(),
        // the link that asks for it, gets it
        url_with_edit: GAME_CREATE.buildUrl({ edit: "W-XYZ" }),
        // the non weak param keeps being inherited
        url_with_filter_only: GAME_CREATE.buildUrl({ filter: "old" }),
      };
    } finally {
      clearRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("route.url is the screen url, route.relativeUrl the visited one", () => {
    const editIdSignal = stateSignal(undefined, {
      id: "game_edit_id",
      type: "string",
      weak: true,
    });
    const GAME_CREATE = route("/games/create", {
      searchParams: { edit: editIdSignal },
    });
    const { updateRoutes, clearRoutes } = setupRoutes([GAME_CREATE]);
    try {
      updateRoutes(`${baseUrl}/games/create?edit=W-ABC`);
      return {
        matching: GAME_CREATE.matching,
        params: GAME_CREATE.params,
        url: GAME_CREATE.url,
        relative_url: GAME_CREATE.relativeUrl,
      };
    } finally {
      clearRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("weak param goes back to default when the route stops matching", () => {
    const editIdSignal = stateSignal(undefined, {
      id: "game_edit_id",
      type: "string",
      weak: true,
    });
    const filterSignal = stateSignal(undefined, {
      id: "game_filter",
      type: "string",
    });
    const HOME = route("/home");
    const GAME_CREATE = route("/games/create", {
      searchParams: { edit: editIdSignal, filter: filterSignal },
    });
    const { updateRoutes, clearRoutes } = setupRoutes([HOME, GAME_CREATE]);
    try {
      updateRoutes(`${baseUrl}/games/create?edit=W-ABC&filter=recent`);
      const onRoute = {
        edit: editIdSignal.value,
        filter: filterSignal.value,
      };
      updateRoutes(`${baseUrl}/home`);
      const afterLeaving = {
        edit: editIdSignal.value,
        // a regular search param is a preference, it survives navigation
        filter: filterSignal.value,
      };
      updateRoutes(`${baseUrl}/games/create`);
      const afterComingBack = {
        edit: editIdSignal.value,
        filter: filterSignal.value,
      };
      return { onRoute, afterLeaving, afterComingBack };
    } finally {
      clearRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("weak param survives a param change on the same route", () => {
    const editIdSignal = stateSignal(undefined, {
      id: "game_edit_id",
      type: "string",
      weak: true,
    });
    const filterSignal = stateSignal(undefined, {
      id: "game_filter",
      type: "string",
    });
    const GAME_CREATE = route("/games/create", {
      searchParams: { edit: editIdSignal, filter: filterSignal },
    });
    const { updateRoutes, clearRoutes } = setupRoutes([GAME_CREATE]);
    const navToCalls = [];
    setRouteIntegration({
      navTo: (url) => {
        navToCalls.push(url);
        updateRoutes(url);
        return Promise.resolve();
      },
    });
    try {
      updateRoutes(`${baseUrl}/games/create?edit=W-ABC`);
      GAME_CREATE.replaceParams({ filter: "recent" });
      return {
        nav_to_calls: navToCalls,
        edit_signal: editIdSignal.value,
        filter_signal: filterSignal.value,
      };
    } finally {
      setRouteIntegration(undefined);
      clearRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("weak path param is not inherited either", () => {
    const editIdSignal = stateSignal(undefined, {
      id: "game_edit_id",
      type: "string",
      weak: true,
    });
    const GAME_CREATE = route(`/games/create/:edit=${editIdSignal}`);
    const { updateRoutes, clearRoutes } = setupRoutes([GAME_CREATE]);
    try {
      updateRoutes(`${baseUrl}/games/create/W-ABC`);
      return {
        edit_signal: editIdSignal.value,
        url_without_params: GAME_CREATE.buildUrl(),
        url_with_edit: GAME_CREATE.buildUrl({ edit: "W-XYZ" }),
      };
    } finally {
      clearRoutes();
      globalSignalRegistry.clear();
    }
  });

  test("weak and persists are contradictory", () => {
    try {
      stateSignal(undefined, {
        id: "game_edit_id",
        type: "string",
        weak: true,
        persists: true,
      });
      return "no error thrown";
    } catch (e) {
      return e.message;
    } finally {
      globalSignalRegistry.clear();
    }
  });
});
