import { snapshotTests } from "@jsenv/snapshot";
import { stateSignal } from "../state/state_signal.js";
import {
  clearAllRoutes,
  registerRoute,
  setBaseUrl,
  updateRoutes,
} from "./route.js";

const baseUrl = "http://localhost:3000";
setBaseUrl(baseUrl);

const run = (pattern, relativeUrl) => {
  const route = registerRoute(pattern);
  updateRoutes(`${baseUrl}${relativeUrl}`);
  clearAllRoutes();

  return route.matching ? route.params : null;
};

await snapshotTests(import.meta.url, ({ test }) => {
  test("basic", () => {
    return {
      matching_url: run("/users/:id", `/users/123`),
      non_matching_url: run("/users/:id", `/admin`),
    };
  });

  test("state signal", () => {
    const sectionSignal = stateSignal("settings");
    return {
      matching_with_param: run(
        `/admin/:section=${sectionSignal}`,
        `/admin/users`,
      ),
      matching_with_default: run(`/admin/:section=${sectionSignal}`, `/admin`),
      non_matching_url: run(`/admin/:section=${sectionSignal}`, `/different`),
    };
  });
});
