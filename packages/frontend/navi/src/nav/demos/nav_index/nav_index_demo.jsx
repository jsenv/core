/**
 * Navigation Index Demo
 *
 * This demo tests different scenarios with index routes and nested navigation:
 *
 * Test Case 1: Simple top-level navigation between Home and Map
 *
 * Test Case 2: Multi-level nested index routes with <Route.Slot />
 *   - /map auto-redirects to Users tab (index route)
 *   - /map/tab_a auto-redirects to Walk sub-tab (nested index route)
 *   - Uses <Route.Slot /> pattern for nested route rendering
 *
 * Test Case 3: Non-index route with nested routes using <Routes>
 *   - Settings tab is NOT index, requires manual navigation
 *   - Uses <Routes> instead of <Route.Slot /> for nested structure
 *
 * Test Case 4: Index route without <Route.Slot />
 *   - Profile tab is marked as index but uses <Routes> for nested routes
 *   - Tests index behavior when not using slot pattern
 */

import { Route, Routes, setupRoutes, Tab, TabList } from "@jsenv/navi";
import { render } from "preact";

const {
  HOME_ROUTE,
  DASHBOARD_ROUTE,
  USERS_SECTION_ROUTE,
  SETTINGS_SECTION_ROUTE,
  ANALYTICS_SECTION_ROUTE,
  USERS_LIST_ROUTE,
  USERS_ACTIVITY_ROUTE,
  SETTINGS_GENERAL_ROUTE,
  SETTINGS_SECURITY_ROUTE,
  ANALYTICS_OVERVIEW_ROUTE,
  ANALYTICS_REPORTS_ROUTE,
} = setupRoutes({
  HOME_ROUTE: "home",
  DASHBOARD_ROUTE: "dashboard{/}?*",
  USERS_SECTION_ROUTE: "dashboard/users{/}?*",
  SETTINGS_SECTION_ROUTE: "dashboard/settings{/}?*",
  ANALYTICS_SECTION_ROUTE: "dashboard/analytics{/}?*",
  USERS_LIST_ROUTE: "dashboard/users/list",
  USERS_ACTIVITY_ROUTE: "dashboard/users/activity",
  SETTINGS_GENERAL_ROUTE: "dashboard/settings/general",
  SETTINGS_SECURITY_ROUTE: "dashboard/settings/security",
  ANALYTICS_OVERVIEW_ROUTE: "dashboard/analytics/overview",
  ANALYTICS_REPORTS_ROUTE: "dashboard/analytics/reports",
});

const App = () => {
  return (
    <div style={{ fontFamily: "system-ui, sans-serif" }}>
      {/* Main Application Header */}
      <header
        style={{
          backgroundColor: "#1f2937",
          color: "white",
          padding: "1rem 2rem",
          boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
        }}
      >
        <h1 style={{ margin: 0, fontSize: "1.5rem" }}>Admin Portal</h1>

        {/* Test Case 1: Primary Navigation */}
        <nav style={{ marginTop: "1rem" }}>
          <TabList
            underline
            style={{ "--tab-color": "#fff", "--tab-active-color": "#60a5fa" }}
          >
            <Tab route={HOME_ROUTE}>🏠 Home</Tab>
            <Tab route={DASHBOARD_ROUTE}>📊 Dashboard</Tab>
          </TabList>
        </nav>
      </header>

      <main style={{ minHeight: "80vh", backgroundColor: "#f9fafb" }}>
        <Routes>
          <Route route={HOME_ROUTE} element={<Home />} />
          <Route route={DASHBOARD_ROUTE} element={<Dashboard />} />
        </Routes>
      </main>
    </div>
  );
};

const Home = () => {
  return (
    <div style={{ padding: "3rem", textAlign: "center" }}>
      <h2 style={{ color: "#1f2937", marginBottom: "1rem" }}>
        Welcome to Admin Portal
      </h2>
      <p
        style={{
          color: "#6b7280",
          fontSize: "1.1rem",
          maxWidth: "600px",
          margin: "0 auto",
        }}
      >
        This is the home page. Navigate to the Dashboard to see the nested
        navigation examples with different index route configurations.
      </p>
      <div
        style={{
          marginTop: "2rem",
          padding: "1.5rem",
          backgroundColor: "#e5f3ff",
          borderRadius: "8px",
          display: "inline-block",
        }}
      >
        <strong>Test Case 1:</strong> Simple top-level navigation between Home
        and Dashboard
      </div>
    </div>
  );
};

const Dashboard = () => {
  return (
    <div style={{ display: "flex", minHeight: "80vh" }}>
      {/* Sidebar Navigation */}
      <aside
        style={{
          width: "250px",
          backgroundColor: "#374151",
          padding: "2rem 0",
          color: "white",
        }}
      >
        <h3
          style={{
            margin: "0 0 1.5rem 1.5rem",
            fontSize: "1.1rem",
            color: "#d1d5db",
          }}
        >
          Dashboard Sections
        </h3>

        <nav>
          <TabList
            vertical
            expandX
            style={{
              "--tab-color": "#d1d5db",
              "--tab-active-color": "#60a5fa",
            }}
          >
            <Tab route={USERS_SECTION_ROUTE}>👥 Users Management</Tab>
            <Tab route={SETTINGS_SECTION_ROUTE}>⚙️ Settings</Tab>
            <Tab route={ANALYTICS_SECTION_ROUTE}>📈 Analytics</Tab>
          </TabList>
        </nav>

        {/* Test Case Indicators */}
        <div style={{ marginTop: "2rem", padding: "0 1.5rem" }}>
          <div
            style={{
              fontSize: "0.8rem",
              color: "#9ca3af",
              backgroundColor: "#4b5563",
              padding: "0.5rem",
              borderRadius: "4px",
              marginBottom: "0.5rem",
            }}
          >
            <strong>Test Case 2:</strong> Users (index + slot)
          </div>
          <div
            style={{
              fontSize: "0.8rem",
              color: "#9ca3af",
              backgroundColor: "#4b5563",
              padding: "0.5rem",
              borderRadius: "4px",
              marginBottom: "0.5rem",
            }}
          >
            <strong>Test Case 3:</strong> Settings (non-index + routes)
          </div>
          <div
            style={{
              fontSize: "0.8rem",
              color: "#9ca3af",
              backgroundColor: "#4b5563",
              padding: "0.5rem",
              borderRadius: "4px",
            }}
          >
            <strong>Test Case 4:</strong> Analytics (index + routes)
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main style={{ flex: 1, backgroundColor: "white" }}>
        <Routes>
          {/* Test Case 2: Index route with nested index using <Route.Slot />
              - USERS_SECTION_ROUTE is marked as index, so /dashboard auto-redirects here
              - USERS_LIST_ROUTE is marked as index, so /dashboard/users auto-redirects to /dashboard/users/list
              - Tests multi-level nested index auto-navigation with slot pattern */}
          <Route
            index
            route={USERS_SECTION_ROUTE}
            element={
              <div>
                {/* Section Header */}
                <header
                  style={{
                    backgroundColor: "#f8fafc",
                    borderBottom: "1px solid #e2e8f0",
                    padding: "1.5rem 2rem",
                  }}
                >
                  <h2 style={{ margin: 0, color: "#1e293b" }}>
                    Users Management
                  </h2>
                  <p style={{ margin: "0.5rem 0 0 0", color: "#64748b" }}>
                    Manage users and view their activity. Auto-redirects to List
                    view (nested index with slot).
                  </p>
                </header>

                {/* Sub-navigation */}
                <div
                  style={{
                    backgroundColor: "#fff",
                    borderBottom: "1px solid #e2e8f0",
                    padding: "0 2rem",
                  }}
                >
                  <TabList
                    underline
                    style={{
                      "--tab-color": "#64748b",
                      "--tab-active-color": "#3b82f6",
                    }}
                  >
                    <Tab route={USERS_LIST_ROUTE}>📋 User List</Tab>
                    <Tab route={USERS_ACTIVITY_ROUTE}>📊 Activity</Tab>
                  </TabList>
                </div>

                {/* Content Area using Route.Slot */}
                <div style={{ padding: "2rem" }}>
                  <Route.Slot />
                </div>
              </div>
            }
          >
            <Route
              index
              route={USERS_LIST_ROUTE}
              element={
                <div>
                  <h3 style={{ color: "#059669" }}>
                    ✓ User List (Auto-loaded via nested index)
                  </h3>
                  <div
                    style={{
                      backgroundColor: "#ecfdf5",
                      border: "1px solid #a7f3d0",
                      borderRadius: "6px",
                      padding: "1rem",
                      marginTop: "1rem",
                    }}
                  >
                    <p>
                      <strong>Route Pattern:</strong> Uses{" "}
                      <code>&lt;Route.Slot /&gt;</code>
                    </p>
                    <p>
                      <strong>Auto-redirect:</strong> /dashboard →
                      /dashboard/users → /dashboard/users/list
                    </p>
                    <p>
                      This demonstrates multi-level index route auto-navigation.
                    </p>
                  </div>
                  <div
                    style={{
                      marginTop: "1rem",
                      display: "grid",
                      gap: "1rem",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(200px, 1fr))",
                    }}
                  >
                    <div
                      style={{
                        border: "1px solid #e2e8f0",
                        borderRadius: "6px",
                        padding: "1rem",
                      }}
                    >
                      <h4>John Doe</h4>
                      <p style={{ color: "#64748b", fontSize: "0.9rem" }}>
                        Admin • Last active 2 hours ago
                      </p>
                    </div>
                    <div
                      style={{
                        border: "1px solid #e2e8f0",
                        borderRadius: "6px",
                        padding: "1rem",
                      }}
                    >
                      <h4>Jane Smith</h4>
                      <p style={{ color: "#64748b", fontSize: "0.9rem" }}>
                        Editor • Last active 1 day ago
                      </p>
                    </div>
                  </div>
                </div>
              }
            />
            <Route
              route={USERS_ACTIVITY_ROUTE}
              element={
                <div>
                  <h3 style={{ color: "#3b82f6" }}>User Activity Dashboard</h3>
                  <div
                    style={{
                      backgroundColor: "#eff6ff",
                      border: "1px solid #93c5fd",
                      borderRadius: "6px",
                      padding: "1rem",
                      marginTop: "1rem",
                    }}
                  >
                    <p>
                      Activity charts and user engagement metrics would go here.
                    </p>
                    <p>This route is accessed manually (not an index route).</p>
                  </div>
                </div>
              }
            />
          </Route>

          {/* Test Case 3: Non-index route with nested routes using <Routes>
              - SETTINGS_SECTION_ROUTE is NOT marked as index, so it won't auto-redirect
              - Has nested routes but uses <Routes> instead of <Route.Slot />
              - Tests manual navigation to non-index tab with nested structure */}
          <Route
            route={SETTINGS_SECTION_ROUTE}
            element={
              <div>
                {/* Section Header */}
                <header
                  style={{
                    backgroundColor: "#f8fafc",
                    borderBottom: "1px solid #e2e8f0",
                    padding: "1.5rem 2rem",
                  }}
                >
                  <h2 style={{ margin: 0, color: "#1e293b" }}>Settings</h2>
                  <p style={{ margin: "0.5rem 0 0 0", color: "#64748b" }}>
                    Configure application settings. Must be manually navigated
                    (non-index with Routes).
                  </p>
                </header>

                {/* Sub-navigation */}
                <div
                  style={{
                    backgroundColor: "#fff",
                    borderBottom: "1px solid #e2e8f0",
                    padding: "0 2rem",
                  }}
                >
                  <TabList
                    underline
                    style={{
                      "--tab-color": "#64748b",
                      "--tab-active-color": "#dc2626",
                    }}
                  >
                    <Tab route={SETTINGS_GENERAL_ROUTE}>🔧 General</Tab>
                    <Tab route={SETTINGS_SECURITY_ROUTE}>🔒 Security</Tab>
                  </TabList>
                </div>

                {/* Content Area using Routes */}
                <div style={{ padding: "2rem" }}>
                  <Routes>
                    <Route
                      index
                      route={SETTINGS_GENERAL_ROUTE}
                      element={
                        <div>
                          <h3 style={{ color: "#dc2626" }}>General Settings</h3>
                          <div
                            style={{
                              backgroundColor: "#fef2f2",
                              border: "1px solid #fca5a5",
                              borderRadius: "6px",
                              padding: "1rem",
                              marginTop: "1rem",
                            }}
                          >
                            <p>
                              <strong>Route Pattern:</strong> Uses{" "}
                              <code>&lt;Routes&gt;</code>
                            </p>
                            <p>
                              <strong>Manual navigation:</strong> User must
                              click Settings first
                            </p>
                            <p>
                              Then auto-redirects to General (this page) as its
                              the index route within Settings.
                            </p>
                          </div>
                        </div>
                      }
                    />
                    <Route
                      route={SETTINGS_SECURITY_ROUTE}
                      element={
                        <div>
                          <h3 style={{ color: "#dc2626" }}>
                            Security Settings
                          </h3>
                          <p>Security configuration options would go here.</p>
                        </div>
                      }
                    />
                  </Routes>
                </div>
              </div>
            }
          />

          {/* Test Case 4: Index route without <Route.Slot /> 
              - ANALYTICS_SECTION_ROUTE is marked as index but uses <Routes> for nested routes
              - Tests index route behavior when not using slot pattern */}
          <Route
            index
            route={ANALYTICS_SECTION_ROUTE}
            element={
              <div>
                {/* Section Header */}
                <header
                  style={{
                    backgroundColor: "#f8fafc",
                    borderBottom: "1px solid #e2e8f0",
                    padding: "1.5rem 2rem",
                  }}
                >
                  <h2 style={{ margin: 0, color: "#1e293b" }}>Analytics</h2>
                  <p style={{ margin: "0.5rem 0 0 0", color: "#64748b" }}>
                    View analytics and reports. Index route but uses Routes
                    instead of Route.Slot.
                  </p>
                </header>

                {/* Sub-navigation */}
                <div
                  style={{
                    backgroundColor: "#fff",
                    borderBottom: "1px solid #e2e8f0",
                    padding: "0 2rem",
                  }}
                >
                  <TabList
                    underline
                    style={{
                      "--tab-color": "#64748b",
                      "--tab-active-color": "#7c3aed",
                    }}
                  >
                    <Tab route={ANALYTICS_OVERVIEW_ROUTE}>📈 Overview</Tab>
                    <Tab route={ANALYTICS_REPORTS_ROUTE}>📊 Reports</Tab>
                  </TabList>
                </div>

                {/* Content Area using Routes */}
                <div style={{ padding: "2rem" }}>
                  <Routes>
                    <Route
                      index
                      route={ANALYTICS_OVERVIEW_ROUTE}
                      element={
                        <div>
                          <h3 style={{ color: "#7c3aed" }}>
                            Analytics Overview
                          </h3>
                          <div
                            style={{
                              backgroundColor: "#f5f3ff",
                              border: "1px solid #c4b5fd",
                              borderRadius: "6px",
                              padding: "1rem",
                              marginTop: "1rem",
                            }}
                          >
                            <p>
                              <strong>Route Pattern:</strong> Uses{" "}
                              <code>&lt;Routes&gt;</code> (like Settings)
                            </p>
                            <p>
                              <strong>Index behavior:</strong> This section IS
                              an index route, but since Users is also index,
                              Users takes priority
                            </p>
                            <p>
                              This tests how multiple index routes are resolved
                              and demonstrates the Routes pattern with an index
                              route.
                            </p>
                          </div>
                        </div>
                      }
                    />
                    <Route
                      route={ANALYTICS_REPORTS_ROUTE}
                      element={
                        <div>
                          <h3 style={{ color: "#7c3aed" }}>Reports</h3>
                          <p>
                            Detailed analytics reports would be displayed here.
                          </p>
                        </div>
                      }
                    />
                  </Routes>
                </div>
              </div>
            }
          />
        </Routes>
      </main>
    </div>
  );
};

render(<App />, document.querySelector("#root"));
