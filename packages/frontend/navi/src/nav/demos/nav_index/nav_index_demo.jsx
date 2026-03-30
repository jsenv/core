/**
 * Navigation Index Demo
 *
 * This demo shows how different navigation patterns work in a realistic admin interface:
 *
 * 🏠 Home vs 📊 Dashboard: Basic page switching
 *
 * When you click Dashboard, you automatically land on Users (the default section)
 * - Users Management: This is the index route ✨ (uses index prop for auto-navigation)
 * - Settings: You must click to open 👆 (uses manual navigation)
 * - Analytics: You must click to open 👆 (uses manual navigation but different pattern)
 * - Monitoring: Has content at base URL 🖥️ (no index needed, displays content directly)
 *
 * Each section demonstrates different technical patterns under the hood.
 */

import { Link, Nav, Route, route, setupRoutes, stateSignal } from "@jsenv/navi";
import { render } from "preact";

const dashboardSectionSignal = stateSignal("users", {});
const userSectionSignal = stateSignal("list", {});
const settingsSectionSignal = stateSignal("general", {});

const HOME_ROUTE = route("home");
const DASHBOARD_ROUTE = route(`dashboard/:section=${dashboardSectionSignal}`);
const USERS_SECTION_ROUTE = route(
  `dashboard/users/:user_section=${userSectionSignal}`,
);
const SETTINGS_SECTION_ROUTE = route(
  `dashboard/settings/:settings_section=${settingsSectionSignal}`,
);
const ANALYTICS_SECTION_ROUTE = route("dashboard/analytics/*");
const REPORTS_SECTION_ROUTE = route("dashboard/monitoring/*");
const USERS_LIST_ROUTE = route("dashboard/users/list");
const USERS_ACTIVITY_ROUTE = route("dashboard/users/activity");
const USERS_NOTHING_ROUTE = route("dashboard/users/nothing");
const SETTINGS_GENERAL_ROUTE = route("dashboard/settings/general");
const SETTINGS_SECURITY_ROUTE = route("dashboard/settings/security");
const ANALYTICS_OVERVIEW_ROUTE = route("dashboard/analytics/overview");
const ANALYTICS_REPORTS_ROUTE = route("dashboard/analytics/reports");
const MONITORING_EXPORT_ROUTE = route("dashboard/monitoring/export");
const MONITORING_ARCHIVE_ROUTE = route("dashboard/monitoring/archive");
const TEST_404_ROUTE = route("test-404");
setupRoutes([
  HOME_ROUTE,
  DASHBOARD_ROUTE,
  USERS_SECTION_ROUTE,
  SETTINGS_SECTION_ROUTE,
  ANALYTICS_SECTION_ROUTE,
  REPORTS_SECTION_ROUTE,
  USERS_LIST_ROUTE,
  USERS_ACTIVITY_ROUTE,
  USERS_NOTHING_ROUTE,
  SETTINGS_GENERAL_ROUTE,
  SETTINGS_SECURITY_ROUTE,
  ANALYTICS_OVERVIEW_ROUTE,
  ANALYTICS_REPORTS_ROUTE,
  MONITORING_EXPORT_ROUTE,
  MONITORING_ARCHIVE_ROUTE,
  TEST_404_ROUTE,
]);

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
          <Nav
            spacing="s"
            style={{ "--tab-color": "#fff", "--tab-active-color": "#60a5fa" }}
          >
            <Link
              appearance="tab"
              padding="s"
              currentIndicator
              route={HOME_ROUTE}
            >
              🏠 Home
            </Link>
            <Link
              appearance="tab"
              padding="s"
              currentIndicator
              route={DASHBOARD_ROUTE}
            >
              📊 Dashboard
            </Link>
            <Link
              appearance="tab"
              padding="s"
              currentIndicator
              route={TEST_404_ROUTE}
            >
              ❌ Test 404
            </Link>
          </Nav>
        </nav>
      </header>

      <main style={{ minHeight: "80vh", backgroundColor: "#f9fafb" }}>
        <Route>
          <Route route={HOME_ROUTE} element={<Home />} />
          <Route route={DASHBOARD_ROUTE} element={<Dashboard />} />
          <Route fallback element={"404 - Page Not Found"} />
        </Route>
      </main>
    </div>
  );
};

// User List Component - Shows actual user data first
const UserListPage = () => (
  <div>
    {/* User List Content */}
    <div
      style={{
        marginTop: "1rem",
        display: "grid",
        gap: "1rem",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
      }}
    >
      <UserCard name="John Doe" role="Admin" lastActive="2 hours ago" />
      <UserCard name="Jane Smith" role="Editor" lastActive="1 day ago" />
    </div>

    <TechnicalExplanation
      color="#059669"
      backgroundColor="#ecfdf5"
      borderColor="#a7f3d0"
      title="How did we get here?"
      explanation={
        <div>
          <p style={{ margin: "0 0 0.5rem 0" }}>
            <strong>🎯 What happened:</strong> You navigated to /dashboard and
            got redirected to /dashboard/users because this route has the index
            prop.
          </p>
          <p style={{ margin: "0 0 0.5rem 0" }}>
            <strong>🤔 Why:</strong> Index props redirect when no specific route
            matches, ensuring /dashboard doesn&apos;t display content - only
            /dashboard/users does.
          </p>
          <p style={{ margin: 0 }}>
            <strong>🛠️ How:</strong> The index prop redirects /dashboard to
            /dashboard/users so you always end up on the &quot;right URL&quot;
            with actual content.
          </p>
        </div>
      }
    />
  </div>
);

// User Activity Component
const UserActivityPage = () => (
  <div>
    <div
      style={{
        backgroundColor: "#eff6ff",
        border: "1px solid #93c5fd",
        borderRadius: "6px",
        padding: "1rem",
        marginTop: "1rem",
      }}
    >
      <p>Activity charts and user engagement metrics would go here.</p>
      <p>This route is accessed manually (not an index route).</p>
    </div>
  </div>
);

// User Card Component
const UserCard = ({ name, role, lastActive }) => (
  <div
    style={{
      border: "1px solid #e2e8f0",
      borderRadius: "6px",
      padding: "1rem",
    }}
  >
    <h4>{name}</h4>
    <p style={{ color: "#64748b", fontSize: "0.9rem" }}>
      {role} • Last active {lastActive}
    </p>
  </div>
);

// Settings Form Component
const SettingsForm = () => (
  <div style={{ marginTop: "1rem" }}>
    <div
      style={{
        backgroundColor: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: "8px",
        padding: "1.5rem",
      }}
    >
      <h4 style={{ margin: "0 0 1rem 0", color: "#dc2626" }}>
        Application Settings
      </h4>
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <input type="checkbox" defaultChecked />
          <span>Enable notifications</span>
        </label>
        <label style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <input type="checkbox" />
          <span>Auto-save drafts</span>
        </label>
        <div>
          <label style={{ display: "block", marginBottom: "0.5rem" }}>
            Theme:
          </label>
          <select
            style={{
              padding: "0.5rem",
              borderRadius: "4px",
              border: "1px solid #e2e8f0",
            }}
          >
            <option>Light</option>
            <option>Dark</option>
            <option>Auto</option>
          </select>
        </div>
      </div>
    </div>
  </div>
);

// Analytics Metrics Component
const AnalyticsMetrics = () => (
  <div
    style={{
      marginTop: "1rem",
      display: "grid",
      gap: "1rem",
      gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
    }}
  >
    <MetricCard
      icon="📈"
      title="Page Views"
      value="12,847"
      change="+23% from last week"
      color="#7c3aed"
      backgroundColor="#faf5ff"
      borderColor="#c4b5fd"
    />
    <MetricCard
      icon="⏱️"
      title="Avg. Session"
      value="4m 32s"
      change="+15s from last week"
      color="#7c3aed"
      backgroundColor="#faf5ff"
      borderColor="#c4b5fd"
    />
  </div>
);

// Monitoring Metrics Component
const MonitoringMetrics = () => (
  <div
    style={{
      marginTop: "2rem",
      display: "grid",
      gap: "1rem",
      gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
    }}
  >
    <MetricCard
      icon="📈"
      title="Server Uptime"
      value="99.9%"
      change="+0.1% from last month"
      color="#0891b2"
      backgroundColor="#f0fdff"
      borderColor="#a5f3fc"
    />
    <MetricCard
      icon="⚡"
      title="Response Time"
      value="142ms"
      change="-15ms from last week"
      color="#0891b2"
      backgroundColor="#f0fdff"
      borderColor="#a5f3fc"
    />
  </div>
);

// Reusable Metric Card Component
const MetricCard = ({
  icon,
  title,
  value,
  change,
  color,
  backgroundColor,
  borderColor,
}) => (
  <div
    style={{
      border: `1px solid ${borderColor}`,
      borderRadius: "8px",
      padding: "1.5rem",
      backgroundColor,
    }}
  >
    <h4 style={{ margin: "0 0 0.5rem 0", color }}>
      {icon} {title}
    </h4>
    <p
      style={{
        margin: "0 0 0.5rem 0",
        fontSize: "2rem",
        fontWeight: "bold",
        color,
      }}
    >
      {value}
    </p>
    <p style={{ margin: 0, color, fontSize: "0.9rem", opacity: 0.8 }}>
      {change}
    </p>
  </div>
);

// Reusable Technical Explanation Component
const TechnicalExplanation = ({
  color,
  backgroundColor,
  borderColor,
  title,
  explanation,
}) => (
  <details
    style={{
      backgroundColor,
      border: `1px solid ${borderColor}`,
      borderRadius: "6px",
      padding: "1rem",
      marginTop: "2rem",
    }}
  >
    <summary
      style={{
        cursor: "pointer",
        fontWeight: "bold",
        color,
      }}
    >
      🔍 {title} (Click to expand)
    </summary>
    <div style={{ marginTop: "0.5rem" }}>{explanation}</div>
  </details>
);

const Home = () => {
  return (
    <div style={{ padding: "3rem", textAlign: "center" }}>
      <h2 style={{ color: "#1f2937", marginBottom: "1rem" }}>
        Welcome to the Admin Portal
      </h2>
      <p
        style={{
          color: "#6b7280",
          fontSize: "1.1rem",
          maxWidth: "600px",
          margin: "0 auto",
        }}
      >
        This demo shows how navigation works in a modern web application. Click{" "}
        &quot;Dashboard&quot; above to see automatic navigation in action!
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
        <strong>🎯 Try this:</strong> Click Dashboard and watch how it
        automatically takes you to Users Management
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

        <Nav
          vertical
          expandX
          spacing="s"
          style={{
            "--link-color": "#d1d5db",
            "--link-color-current": "#60a5fa",
          }}
        >
          <Link
            route={USERS_SECTION_ROUTE}
            appearance="tab"
            currentIndicator="left"
            padding="s"
          >
            👥 Users Management
          </Link>
          <Link
            route={SETTINGS_SECTION_ROUTE}
            appearance="tab"
            currentIndicator="left"
            padding="s"
          >
            ⚙️ Settings
          </Link>
          <Link
            route={ANALYTICS_SECTION_ROUTE}
            appearance="tab"
            currentIndicator="left"
            padding="s"
          >
            📈 Analytics
          </Link>
          <Link
            route={REPORTS_SECTION_ROUTE}
            appearance="tab"
            currentIndicator="left"
            padding="s"
          >
            🖥️ Monitoring
          </Link>
        </Nav>

        {/* Navigation Behavior Indicators */}
        <div style={{ marginTop: "2rem", padding: "0 1.5rem" }}>
          <div
            style={{
              fontSize: "0.8rem",
              color: "#10b981",
              backgroundColor: "#065f46",
              padding: "0.5rem",
              borderRadius: "4px",
              marginBottom: "0.5rem",
            }}
          >
            ✨ <strong>Users:</strong> Opens automatically
          </div>
          <div
            style={{
              fontSize: "0.8rem",
              color: "#f59e0b",
              backgroundColor: "#78350f",
              padding: "0.5rem",
              borderRadius: "4px",
              marginBottom: "0.5rem",
            }}
          >
            👆 <strong>Settings:</strong> Click to open
          </div>
          <div
            style={{
              fontSize: "0.8rem",
              color: "#8b5cf6",
              backgroundColor: "#4c1d95",
              padding: "0.5rem",
              borderRadius: "4px",
            }}
          >
            👆 <strong>Analytics:</strong> Click to open
          </div>
          <div
            style={{
              fontSize: "0.8rem",
              color: "#06b6d4",
              backgroundColor: "#164e63",
              padding: "0.5rem",
              borderRadius: "4px",
            }}
          >
            🖥️ <strong>Monitoring:</strong> Has content at base URL
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main style={{ flex: 1, backgroundColor: "white" }}>
        <Route>
          {/* Index route with nested index using <Route.Slot />
              - USERS_SECTION_ROUTE has index prop, so /dashboard redirects to /dashboard/users
              - USERS_LIST_ROUTE has index prop, so /dashboard/users redirects to /dashboard/users/list
              - Tests URL redirection with index props ensuring proper URLs are used */}
          <Route
            route={USERS_SECTION_ROUTE}
            element={
              <div>
                {/* Section Header */}
                <header
                  style={{
                    backgroundColor: "#f0fdf4",
                    borderBottom: "1px solid #bbf7d0",
                    padding: "1.5rem 2rem",
                  }}
                >
                  <h2 style={{ margin: 0, color: "#15803d" }}>
                    ✨ Users Management
                  </h2>
                </header>

                {/* Sub-navigation */}
                <div
                  style={{
                    backgroundColor: "#fff",
                    borderBottom: "1px solid #e2e8f0",
                    padding: "0 2rem",
                  }}
                >
                  <Nav
                    underline
                    style={{
                      "--tab-color": "#64748b",
                      "--tab-active-color": "#3b82f6",
                    }}
                  >
                    <Link route={USERS_LIST_ROUTE}>📋 User List</Link>
                    <Link route={USERS_ACTIVITY_ROUTE}>📊 Activity</Link>
                    <Link route={USERS_NOTHING_ROUTE}>❌ Nothing</Link>
                  </Nav>
                </div>
              </div>
            }
          >
            <div style={{ padding: "0 2rem" }}>
              <Route route={USERS_LIST_ROUTE} element={<UserListPage />} />
              <Route
                route={USERS_ACTIVITY_ROUTE}
                element={<UserActivityPage />}
              />
              <Route fallback element={"This url does not exists."} />
            </div>
          </Route>

          {/* Non-index route with manual navigation using <Routes>
              - SETTINGS_SECTION_ROUTE has no index prop, so requires explicit navigation
              - Has nested routes but uses <Routes> instead of <Route.Slot />
              - /dashboard/settings has actual content, no redirection happens */}
          <Route route={SETTINGS_SECTION_ROUTE} element={<SettingsSection />} />

          {/* Non-index route using <Routes> for nested navigation
              - ANALYTICS_SECTION_ROUTE uses <Routes> for nested routes, no index prop on parent
              - Shows manual navigation pattern with nested routes
              - /dashboard/analytics has content, nested routes redirect normally */}
          <Route
            route={ANALYTICS_SECTION_ROUTE}
            element={<AnalyticsSection />}
          />

          {/* Monitoring section with content at base URL - no index needed
              - REPORTS_SECTION_ROUTE has content at /dashboard/monitoring directly
              - Also has nested sub-pages for specific actions
              - Demonstrates route with both base content and optional sub-navigation */}
          <Route
            route={REPORTS_SECTION_ROUTE}
            element={<MonitoringSection />}
          />
        </Route>
      </main>
    </div>
  );
};

// Settings Section - Uses Routes pattern (manual navigation)
const SettingsSection = () => (
  <div>
    <SectionHeader
      backgroundColor="#fef2f2"
      borderColor="#fecaca"
      color="#dc2626"
      title="👆 Settings"
      description=""
    />
    <div
      style={{
        backgroundColor: "#fff",
        borderBottom: "1px solid #e2e8f0",
        padding: "0 2rem",
      }}
    >
      <Nav
        underline
        style={{
          "--tab-color": "#64748b",
          "--tab-active-color": "#dc2626",
        }}
      >
        <Link route={SETTINGS_GENERAL_ROUTE}>🔧 General</Link>
        <Link route={SETTINGS_SECURITY_ROUTE}>🔒 Security</Link>
      </Nav>
    </div>
    <div style={{ padding: "0 2rem" }}>
      <Route>
        <Route
          route={SETTINGS_GENERAL_ROUTE}
          element={<GeneralSettingsPage />}
        />
        <Route
          route={SETTINGS_SECURITY_ROUTE}
          element={<SecuritySettingsPage />}
        />
      </Route>
    </div>
  </div>
);

// Analytics Section - Uses Routes pattern (manual navigation, different impl)
const AnalyticsSection = () => (
  <div>
    <SectionHeader
      backgroundColor="#f3f4f6"
      borderColor="#d1d5db"
      color="#7c3aed"
      title="👆 Analytics"
      description=""
    />
    <div
      style={{
        backgroundColor: "#fff",
        borderBottom: "1px solid #e2e8f0",
        padding: "0 2rem",
      }}
    >
      <Nav
        underline
        style={{
          "--tab-color": "#64748b",
          "--tab-active-color": "#7c3aed",
        }}
      >
        <Link route={ANALYTICS_OVERVIEW_ROUTE}>📈 Overview</Link>
        <Link route={ANALYTICS_REPORTS_ROUTE}>📊 Reports</Link>
      </Nav>
    </div>
    <div style={{ padding: "0 2rem" }}>
      <Route>
        <Route
          route={ANALYTICS_OVERVIEW_ROUTE}
          element={<AnalyticsOverviewPage />}
        />
        <Route
          route={ANALYTICS_REPORTS_ROUTE}
          element={<AnalyticsReportsPage />}
        />
      </Route>
    </div>
  </div>
);

// Monitoring Section - Content-first with optional sub-navigation
const MonitoringSection = () => (
  <div>
    <SectionHeader
      backgroundColor="#ecfeff"
      borderColor="#67e8f9"
      color="#0891b2"
      title="🖥️ System Monitoring"
      description=""
    />
    <div style={{ padding: "0 2rem" }}>
      <MonitoringOverviewPage />
    </div>
  </div>
);

// Page Components
const GeneralSettingsPage = () => (
  <div>
    <SettingsForm />
    <TechnicalExplanation
      color="#dc2626"
      backgroundColor="#fef2f2"
      borderColor="#fca5a5"
      title="How did we get here?"
      explanation={
        <div>
          <p style={{ margin: "0 0 0.5rem 0" }}>
            <strong>🎯 What happened:</strong> You clicked Settings, then landed
            on General (the default sub-section).
          </p>
          <p style={{ margin: "0 0 0.5rem 0" }}>
            <strong>🤔 Why:</strong> Settings requires intentional navigation
            since it&apos;s used less frequently than user management.
          </p>
          <p style={{ margin: 0 }}>
            <strong>🛠️ How:</strong> Uses manual navigation with standard
            routing (no slots needed).
          </p>
        </div>
      }
    />
  </div>
);

const SecuritySettingsPage = () => (
  <div>
    <p>Security configuration options would go here.</p>
  </div>
);

const AnalyticsOverviewPage = () => (
  <div>
    <AnalyticsMetrics />
    <TechnicalExplanation
      color="#7c3aed"
      backgroundColor="#f5f3ff"
      borderColor="#c4b5fd"
      title="How did we get here?"
      explanation={
        <div>
          <h4 style={{ color: "#7c3aed" }}>🔍 What happened?</h4>
          <p>
            You clicked &quot;Analytics&quot; which brought you here, similar to
            how Settings works.
          </p>
          <h4 style={{ color: "#7c3aed" }}>🤔 Why did this happen?</h4>
          <p>
            Analytics is configured with a <code>Routes</code> pattern that
            requires deliberate user interaction - it won&apos;t auto-open like
            Users.
          </p>
          <h4 style={{ color: "#7c3aed" }}>⚙️ How does this work?</h4>
          <p>
            Analytics uses the same <code>Routes</code> component pattern as
            Settings, demonstrating consistent manual navigation behavior across
            different sections.
          </p>
        </div>
      }
    />
  </div>
);

const AnalyticsReportsPage = () => (
  <div>
    <p>Detailed analytics reports would be displayed here.</p>
  </div>
);

const MonitoringOverviewPage = () => (
  <div>
    <MonitoringMetrics />
    <div
      style={{
        marginTop: "3rem",
        paddingTop: "2rem",
        borderTop: "1px solid #e2e8f0",
      }}
    >
      <h4 style={{ color: "#0891b2", marginBottom: "1rem" }}>
        Additional Tools
      </h4>
      <Nav
        style={{
          "--tab-color": "#64748b",
          "--tab-active-color": "#0891b2",
          "fontSize": "0.9rem",
        }}
      >
        <Link route={MONITORING_EXPORT_ROUTE}>🚨 Alerts</Link>
        <Link route={MONITORING_ARCHIVE_ROUTE}>📋 Logs</Link>
      </Nav>
      <Route>
        <Route
          route={MONITORING_EXPORT_ROUTE}
          element={<MonitoringAlertsPage />}
        />
        <Route
          route={MONITORING_ARCHIVE_ROUTE}
          element={<MonitoringLogsPage />}
        />
      </Route>
    </div>
    <TechnicalExplanation
      color="#0891b2"
      backgroundColor="#f0fdff"
      borderColor="#a5f3fc"
      title="How is this different?"
      explanation={
        <div>
          <h4 style={{ color: "#0891b2" }}>🎯 What&apos;s different here?</h4>
          <p>
            This section shows content directly at /dashboard/monitoring - no
            redirect needed because there&apos;s actual content to display.
          </p>
          <h4 style={{ color: "#0891b2" }}>🤔 Why no index route?</h4>
          <p>
            Index routes are only needed when the base URL has no content. Here,
            /dashboard/monitoring shows this dashboard directly.
          </p>
          <h4 style={{ color: "#0891b2" }}>⚙️ How does this work?</h4>
          <p>
            The route matches /dashboard/monitoring exactly and displays
            content. Sub-pages are available but optional - users can stay on
            the main dashboard or navigate to specific tools.
          </p>
        </div>
      }
    />
  </div>
);

const MonitoringAlertsPage = () => (
  <div>
    <p>
      Alert configuration and notification settings would be available here.
    </p>
  </div>
);

const MonitoringLogsPage = () => (
  <div>
    <p>Application logs and system event history.</p>
  </div>
);

// Reusable Layout Components
const SectionHeader = ({
  backgroundColor,
  borderColor,
  color,
  title,
  description,
}) => (
  <header
    style={{
      backgroundColor,
      borderBottom: `1px solid ${borderColor}`,
      padding: "1.5rem 2rem",
    }}
  >
    <h2 style={{ margin: 0, color }}>{title}</h2>
    <p style={{ margin: "0.5rem 0 0 0", color }}>{description}</p>
  </header>
);

render(<App />, document.querySelector("#root"));
