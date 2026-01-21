# [url defaults with nested routes](../../route_matching.test.js#L48)

```js
// Helper function that re-creates routes for each test case
const runWithFreshRoutes = (routeType, relativeUrl) => {
  clearAllRoutes();

  const sectionSignal = stateSignal("settings");
  const tabSignal = stateSignal("general");
  const analyticsTabSignal = stateSignal("overview");

  // Re-register all routes for each test
  registerRoute("/");
  const ADMIN_ROUTE = registerRoute(`/admin/:section=${sectionSignal}/`);
  const ADMIN_SETTINGS_ROUTE = registerRoute(
    `/admin/settings/:tab=${tabSignal}`,
  );
  const ADMIN_ANALYTICS_ROUTE = registerRoute(
    `/admin/analytics/?tab=${analyticsTabSignal}`,
  );

  // Select the target route by type
  let targetRoute;
  if (routeType === "admin") {
    targetRoute = ADMIN_ROUTE;
  } else if (routeType === "settings") {
    targetRoute = ADMIN_SETTINGS_ROUTE;
  } else if (routeType === "analytics") {
    targetRoute = ADMIN_ANALYTICS_ROUTE;
  }

  updateRoutes(`${baseUrl}${relativeUrl}`);
  return targetRoute.matching ? targetRoute.params : null;
};

// Test various URL matching scenarios
const testResults = {
  // Admin route tests - basic parameter matching with defaults
  admin_root_matches_section_default: runWithFreshRoutes("admin", `/admin`),
  admin_root_with_slash: runWithFreshRoutes("admin", `/admin/`),
  admin_with_users_section: runWithFreshRoutes("admin", `/admin/users/`),
  admin_users_without_trailing_slash: runWithFreshRoutes(
    "admin",
    `/admin/users`,
  ),

  // Settings route tests - inheritance and parameter handling
  settings_route_matches_admin_root: runWithFreshRoutes(
    "settings",
    `/admin`,
  ),
  settings_root_without_slash: runWithFreshRoutes("settings", `/admin`),
  settings_root_with_slash: runWithFreshRoutes("settings", `/admin/`),
  settings_with_general_tab: runWithFreshRoutes(
    "settings",
    `/admin/settings/general`,
  ),
  settings_with_security_tab: runWithFreshRoutes(
    "settings",
    `/admin/settings/security`,
  ),
  settings_with_literal_settings_path: runWithFreshRoutes(
    "settings",
    `/admin/settings`,
  ),
  settings_with_wrong_search_param: runWithFreshRoutes(
    "settings",
    `/admin?wrongParam=value`,
  ),
  settings_should_not_match_analytics_url: runWithFreshRoutes(
    "settings",
    `/admin/analytics`,
  ),
  settings_should_not_match_users_url: runWithFreshRoutes(
    "settings",
    `/admin/users`,
  ),
  settings_with_different_section: runWithFreshRoutes(
    "settings",
    `/admin/different`,
  ),

  // Analytics route tests - inheritance and search parameters
  analytics_with_overview_tab: runWithFreshRoutes(
    "analytics",
    `/admin/analytics`,
  ),
  analytics_with_performance_tab: runWithFreshRoutes(
    "analytics",
    `/admin/analytics?tab=performance`,
  ),
  analytics_root_without_slash: runWithFreshRoutes("analytics", `/admin`),
  analytics_root_with_slash: runWithFreshRoutes("analytics", `/admin/`),
  analytics_with_literal_analytics_path: runWithFreshRoutes(
    "analytics",
    `/admin/analytics`,
  ),
  analytics_with_wrong_search_param: runWithFreshRoutes(
    "analytics",
    `/admin?wrongParam=value`,
  ),
  analytics_should_not_match_settings_url: runWithFreshRoutes(
    "analytics",
    `/admin/settings`,
  ),
  analytics_should_not_match_users_url: runWithFreshRoutes(
    "analytics",
    `/admin/users`,
  ),
  analytics_with_different_section: runWithFreshRoutes(
    "analytics",
    `/admin/different`,
  ),
};

clearAllRoutes();

return testResults;
```

```js
{
  "admin_root_matches_section_default": {
    "section": "settings"
  },
  "admin_root_with_slash": {
    "section": "settings"
  },
  "admin_with_users_section": {
    "section": "users"
  },
  "admin_users_without_trailing_slash": {
    "section": "users"
  },
  "settings_route_matches_admin_root": {
    "tab": "general"
  },
  "settings_root_without_slash": {
    "tab": "general"
  },
  "settings_root_with_slash": {
    "tab": "general"
  },
  "settings_with_general_tab": {
    "tab": "general"
  },
  "settings_with_security_tab": {
    "tab": "security"
  },
  "settings_with_literal_settings_path": {
    "tab": "general"
  },
  "settings_with_wrong_search_param": {
    "wrongParam": "value",
    "tab": "general"
  },
  "settings_should_not_match_analytics_url": null,
  "settings_should_not_match_users_url": null,
  "settings_with_different_section": null,
  "analytics_with_overview_tab": {
    "tab": "overview"
  },
  "analytics_with_performance_tab": {
    "tab": "performance"
  },
  "analytics_root_without_slash": {
    "tab": "overview"
  },
  "analytics_root_with_slash": {
    "tab": "overview"
  },
  "analytics_with_literal_analytics_path": {
    "tab": "overview"
  },
  "analytics_with_wrong_search_param": {
    "wrongParam": "value",
    "tab": "overview"
  },
  "analytics_should_not_match_settings_url": null,
  "analytics_should_not_match_users_url": null,
  "analytics_with_different_section": null
}
```

---

<sub>
  Generated by <a href="https://github.com/jsenv/core/tree/main/packages/tooling/snapshot">@jsenv/snapshot</a>
</sub>
