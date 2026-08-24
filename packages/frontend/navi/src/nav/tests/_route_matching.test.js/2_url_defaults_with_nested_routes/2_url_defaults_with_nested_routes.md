# [url defaults with nested routes](../../route_matching.test.js)

```js
const sectionSignal = stateSignal("settings", { id: "nested_section" });
const tabSignal = stateSignal("general", { id: "nested_tab" });
const analyticsTabSignal = stateSignal("overview", {
  id: "nested_analytics_tab",
});
const ROOT = route("/");
const ADMIN_ROUTE = route(`/admin/:section=${sectionSignal}/`);
const ADMIN_SETTINGS_ROUTE = route(`/admin/settings/:tab=${tabSignal}`);
const ADMIN_ANALYTICS_ROUTE = route("/admin/analytics/", {
  searchParams: { tab: analyticsTabSignal },
});
const { updateRoutes, clearRoutes } = setupRoutes([
  ROOT,
  ADMIN_ROUTE,
  ADMIN_SETTINGS_ROUTE,
  ADMIN_ANALYTICS_ROUTE,
]);

try {
  // Admin route tests - basic parameter matching with defaults
  updateRoutes(`${baseUrl}/admin`);
  const admin_root_matches_section_default = getMatchParams(ADMIN_ROUTE);
  updateRoutes(`${baseUrl}/admin/`);
  const admin_root_with_slash = getMatchParams(ADMIN_ROUTE);
  updateRoutes(`${baseUrl}/admin/settings`);
  const admin_on_settings = getMatchParams(ADMIN_ROUTE);
  updateRoutes(`${baseUrl}/admin/settings/`);
  const admin_on_settings_trailing_slash = getMatchParams(ADMIN_ROUTE);
  updateRoutes(`${baseUrl}/admin/settings/advanced`);
  const admin_on_settings_tab = getMatchParams(ADMIN_ROUTE);
  updateRoutes(`${baseUrl}/admin/analytics`);
  const admin_on_analytics = getMatchParams(ADMIN_ROUTE);
  updateRoutes(`${baseUrl}/admin/analytics?tab=details`);
  const admin_on_analytics_tab = getMatchParams(ADMIN_ROUTE);
  updateRoutes(`${baseUrl}/admin/analytics/?tab=details`);
  const admin_on_analytics_trailing_slash_tab = getMatchParams(ADMIN_ROUTE);

  // Settings route tests - inheritance and parameter handling
  updateRoutes(`${baseUrl}/admin`);
  const settings_route_matches_admin_root =
    getMatchParams(ADMIN_SETTINGS_ROUTE);
  const settings_root_without_slash = getMatchParams(ADMIN_SETTINGS_ROUTE);
  updateRoutes(`${baseUrl}/admin/`);
  const settings_root_with_slash = getMatchParams(ADMIN_SETTINGS_ROUTE);
  updateRoutes(`${baseUrl}/admin/settings/general`);
  const settings_with_general_tab = getMatchParams(ADMIN_SETTINGS_ROUTE);
  updateRoutes(`${baseUrl}/admin/settings/security`);
  const settings_with_security_tab = getMatchParams(ADMIN_SETTINGS_ROUTE);
  updateRoutes(`${baseUrl}/admin/settings`);
  const settings_with_literal_settings_path =
    getMatchParams(ADMIN_SETTINGS_ROUTE);
  updateRoutes(`${baseUrl}/admin?wrongParam=value`);
  const settings_with_wrong_search_param =
    getMatchParams(ADMIN_SETTINGS_ROUTE);
  updateRoutes(`${baseUrl}/admin/analytics`);
  const settings_should_not_match_analytics_url =
    getMatchParams(ADMIN_SETTINGS_ROUTE);
  updateRoutes(`${baseUrl}/admin/users`);
  const settings_should_not_match_users_url =
    getMatchParams(ADMIN_SETTINGS_ROUTE);
  updateRoutes(`${baseUrl}/admin/different`);
  const settings_with_different_section =
    getMatchParams(ADMIN_SETTINGS_ROUTE);

  // Analytics route tests - inheritance and search parameters
  updateRoutes(`${baseUrl}/admin/analytics`);
  const analytics_with_overview_tab = getMatchParams(ADMIN_ANALYTICS_ROUTE);
  updateRoutes(`${baseUrl}/admin/analytics?tab=performance`);
  const analytics_with_performance_tab = getMatchParams(
    ADMIN_ANALYTICS_ROUTE,
  );
  updateRoutes(`${baseUrl}/admin`);
  const analytics_root_without_slash = getMatchParams(
    ADMIN_ANALYTICS_ROUTE,
  );
  updateRoutes(`${baseUrl}/admin/`);
  const analytics_root_with_slash = getMatchParams(ADMIN_ANALYTICS_ROUTE);
  updateRoutes(`${baseUrl}/admin/analytics`);
  const analytics_with_literal_analytics_path = getMatchParams(
    ADMIN_ANALYTICS_ROUTE,
  );
  updateRoutes(`${baseUrl}/admin?wrongParam=value`);
  const analytics_with_wrong_search_param = getMatchParams(
    ADMIN_ANALYTICS_ROUTE,
  );
  updateRoutes(`${baseUrl}/admin/settings`);
  const analytics_should_not_match_settings_url = getMatchParams(
    ADMIN_ANALYTICS_ROUTE,
  );
  updateRoutes(`${baseUrl}/admin/users`);
  const analytics_should_not_match_users_url = getMatchParams(
    ADMIN_ANALYTICS_ROUTE,
  );
  updateRoutes(`${baseUrl}/admin/different`);
  const analytics_with_different_section = getMatchParams(
    ADMIN_ANALYTICS_ROUTE,
  );

  return {
    admin_root_matches_section_default,
    admin_root_with_slash,
    admin_on_settings,
    admin_on_settings_trailing_slash,
    admin_on_settings_tab,
    admin_on_analytics,
    admin_on_analytics_tab,
    admin_on_analytics_trailing_slash_tab,
    settings_route_matches_admin_root,
    settings_root_without_slash,
    settings_root_with_slash,
    settings_with_general_tab,
    settings_with_security_tab,
    settings_with_literal_settings_path,
    settings_with_wrong_search_param,
    settings_should_not_match_analytics_url,
    settings_should_not_match_users_url,
    settings_with_different_section,
    analytics_with_overview_tab,
    analytics_with_performance_tab,
    analytics_root_without_slash,
    analytics_root_with_slash,
    analytics_with_literal_analytics_path,
    analytics_with_wrong_search_param,
    analytics_should_not_match_settings_url,
    analytics_should_not_match_users_url,
    analytics_with_different_section,
  };
} finally {
  clearRoutes();
  globalSignalRegistry.clear();
}
```

```js
{
  "admin_root_matches_section_default": {
    "section": "settings"
  },
  "admin_root_with_slash": {
    "section": "settings"
  },
  "admin_on_settings": {
    "section": "settings"
  },
  "admin_on_settings_trailing_slash": {
    "section": "settings"
  },
  "admin_on_settings_tab": {
    "section": "settings",
    "tab": "advanced"
  },
  "admin_on_analytics": {
    "section": "analytics"
  },
  "admin_on_analytics_tab": {
    "section": "analytics",
    "tab": "details"
  },
  "admin_on_analytics_trailing_slash_tab": {
    "section": "analytics",
    "tab": "details"
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
  "analytics_root_without_slash": null,
  "analytics_root_with_slash": null,
  "analytics_with_literal_analytics_path": {
    "tab": "overview"
  },
  "analytics_with_wrong_search_param": null,
  "analytics_should_not_match_settings_url": null,
  "analytics_should_not_match_users_url": null,
  "analytics_with_different_section": null
}
```

---

<sub>
  Generated by <a href="https://github.com/jsenv/core/tree/main/packages/tooling/snapshot">@jsenv/snapshot</a>
</sub>
