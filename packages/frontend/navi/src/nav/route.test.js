import { snapshotTests } from "@jsenv/snapshot";
import { stateSignal } from "../state/state_signal.js";
import {
  clearAllRoutes,
  registerRoute,
  setBaseUrl,
  updateRoutes,
} from "./route.js";

const baseUrl = "http://localhost:3000";

const testRoute = (route, url) => {
  const isVisited = () => false;

  updateRoutes(url, {
    navigationType: "push",
    isVisited,
  });

  return {
    matching: route.matching,
    params: route.params,
    urlPattern: route.urlPattern,
  };
};

await snapshotTests(import.meta.url, ({ test }) => {
  // Set up base URL for all tests
  setBaseUrl(baseUrl);

  test("route without state signal", () => {
    const route = registerRoute("/users/:id");

    const result = {
      matching_url: testRoute(route, `${baseUrl}/users/123`),
      non_matching_url: testRoute(route, `${baseUrl}/admin`),
    };

    clearAllRoutes();

    return result;
  });

  test("route with state signal (pattern optimization)", () => {
    // Create route with default parameter
    const sectionSignal = stateSignal("settings", { defaultValue: "settings" });
    const route = registerRoute(`/admin/:section=${sectionSignal}`);

    const result = {
      matching_with_param: testRoute(route, `${baseUrl}/admin/users`),
      matching_with_default: testRoute(route, `${baseUrl}/admin`),
      non_matching_url: testRoute(route, `${baseUrl}/different`),
    };

    clearAllRoutes();

    return result;
  });
});
