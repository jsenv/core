import { render } from "preact";

import {
  Route,
  RouteLink,
  Routes,
  setupRoutes,
  stateSignal,
  TabList,
} from "@jsenv/navi";

const sectionSignal = stateSignal("settings", {
  id: "section",
  enum: ["settings", "analytics"],
  persists: true,
});
const settingsTabSignal = stateSignal("general", {
  id: "settings_tab",
  enum: ["general", "advanced"],
  persists: true,
  debug: true,
});
const analyticsTabSignal = stateSignal("overview", {
  id: "analytics_tab",
  enum: ["overview", "details"],
  persists: true,
});
const { HOME_ROUTE, ADMIN_ROUTE, ADMIN_SETTINGS_ROUTE, ADMIN_ANALYTICS_ROUTE } =
  setupRoutes({
    HOME_ROUTE: "/",
    ADMIN_ROUTE: `/admin/:section=${sectionSignal}/`,
    ADMIN_SETTINGS_ROUTE: `/admin/settings/:tab=${settingsTabSignal}`,
    ADMIN_ANALYTICS_ROUTE: `/admin/analytics?tab=${analyticsTabSignal}`,
  });

const App = () => {
  return (
    <div
      style={{
        fontFamily: "Arial, sans-serif",
        maxWidth: "1000px",
        margin: "0 auto",
        padding: "20px",
      }}
    >
      <TabList>
        <TabList.Tab route={HOME_ROUTE}>Home</TabList.Tab>
        <TabList.Tab route={ADMIN_ROUTE}>Admin</TabList.Tab>
      </TabList>

      <div style={{ marginTop: "20px" }}>
        <Routes>
          <Route route={HOME_ROUTE} element={<HomePage />} />
          <Route route={ADMIN_ROUTE} element={<DashboardPage />} />
        </Routes>
      </div>
    </div>
  );
};

const HomePage = () => {
  return (
    <div>
      <h2>Dashboard Navigation Demo</h2>
      <p>
        This demo shows nested navigation with a vertical menu and horizontal
        tabs. It tests if both menu selection and tab selection are preserved
        during navigation and page refresh.
      </p>
      <div style={{ marginTop: "15px" }}>
        <RouteLink
          route={ADMIN_ROUTE}
          style={{
            padding: "10px 20px",
            backgroundColor: "#007bff",
            color: "white",
            textDecoration: "none",
            borderRadius: "4px",
            display: "inline-block",
          }}
        >
          Go to Dashboard
        </RouteLink>
      </div>
    </div>
  );
};

const DashboardPage = () => {
  return (
    <div>
      <h2>Dashboard</h2>

      <div style={{ display: "flex", gap: "20px", marginTop: "20px" }}>
        {/* Vertical Menu */}
        <div
          style={{
            width: "200px",
            backgroundColor: "#f8f9fa",
            borderRadius: "8px",
            padding: "15px",
          }}
        >
          <h3 style={{ marginTop: 0, marginBottom: "15px", fontSize: "16px" }}>
            Menu
          </h3>

          <TabList vertical>
            <TabList.Tab
              route={ADMIN_SETTINGS_ROUTE}
              expandX
              borderRadius="s"
              paddingLeft="s"
            >
              ⚙️ Settings
            </TabList.Tab>
            <TabList.Tab
              route={ADMIN_ANALYTICS_ROUTE}
              expandX
              borderRadius="s"
              paddingLeft="s"
            >
              📊 Analytics
            </TabList.Tab>
          </TabList>
        </div>

        {/* Main Content Area */}
        <div style={{ flex: 1 }}>
          <Routes>
            <Route route={ADMIN_SETTINGS_ROUTE} element={<SettingsPanel />} />
            <Route route={ADMIN_ANALYTICS_ROUTE} element={<AnalyticsPanel />} />
          </Routes>
        </div>
      </div>
    </div>
  );
};

const SettingsPanel = () => {
  return (
    <div>
      <h3>Settings</h3>

      {/* Horizontal Tabs */}
      <TabList style={{ marginBottom: "20px" }}>
        <TabList.Tab
          route={ADMIN_SETTINGS_ROUTE}
          routeParams={{ tab: "general" }}
        >
          General
        </TabList.Tab>
        <TabList.Tab
          route={ADMIN_SETTINGS_ROUTE}
          routeParams={{ tab: "advanced" }}
        >
          Advanced
        </TabList.Tab>
      </TabList>

      {/* Tab Content */}
      <div
        style={{
          padding: "20px",
          backgroundColor: "#fff",
          border: "1px solid #dee2e6",
          borderRadius: "8px",
          minHeight: "300px",
        }}
      >
        <Routes>
          <Route
            route={ADMIN_SETTINGS_ROUTE}
            routeParams={{ tab: "general" }}
            element={<GeneralSettingsTabContent />}
          />
          <Route
            route={ADMIN_SETTINGS_ROUTE}
            routeParams={{ tab: "advanced" }}
            element={<AdvancedSettingsTagContent />}
          />
        </Routes>
      </div>
    </div>
  );
};
const GeneralSettingsTabContent = () => {
  return (
    <div>
      <h4>General Settings</h4>
      <p>Configure your basic application settings here.</p>
      <div style={{ marginTop: "20px" }}>
        <div style={{ marginBottom: "15px" }}>
          <label
            style={{
              display: "block",
              marginBottom: "5px",
              fontWeight: "bold",
            }}
          >
            Application Name:
          </label>
          <input
            type="text"
            defaultValue="My Dashboard App"
            style={{
              width: "100%",
              maxWidth: "300px",
              padding: "8px",
              border: "1px solid #ccc",
              borderRadius: "4px",
            }}
          />
        </div>
        <div style={{ marginBottom: "15px" }}>
          <label
            style={{
              display: "block",
              marginBottom: "5px",
              fontWeight: "bold",
            }}
          >
            Theme:
          </label>
          <select
            style={{
              padding: "8px",
              border: "1px solid #ccc",
              borderRadius: "4px",
            }}
          >
            <option>Light</option>
            <option>Dark</option>
            <option>Auto</option>
          </select>
        </div>
      </div>
    </div>
  );
};
const AdvancedSettingsTagContent = () => {
  return (
    <div>
      <h4>Advanced Settings</h4>
      <p>Configure advanced options and integrations.</p>
      <div style={{ marginTop: "20px" }}>
        <div style={{ marginBottom: "15px" }}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <input type="checkbox" />
            <span>Enable debug mode</span>
          </label>
        </div>
        <div style={{ marginBottom: "15px" }}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <input type="checkbox" />
            <span>Enable analytics tracking</span>
          </label>
        </div>
        <div style={{ marginBottom: "15px" }}>
          <label
            style={{
              display: "block",
              marginBottom: "5px",
              fontWeight: "bold",
            }}
          >
            API Endpoint:
          </label>
          <input
            type="url"
            defaultValue="https://api.example.com"
            style={{
              width: "100%",
              maxWidth: "400px",
              padding: "8px",
              border: "1px solid #ccc",
              borderRadius: "4px",
            }}
          />
        </div>
      </div>
    </div>
  );
};

const AnalyticsPanel = () => {
  return (
    <div>
      <h3>Analytics</h3>

      {/* Horizontal Tabs */}
      <TabList style={{ marginBottom: "20px" }}>
        <TabList.Tab
          route={ADMIN_ANALYTICS_ROUTE}
          routeParams={{ tab: "overview" }}
        >
          Overview
        </TabList.Tab>
        <TabList.Tab
          route={ADMIN_ANALYTICS_ROUTE}
          routeParams={{ tab: "details" }}
        >
          Details
        </TabList.Tab>
      </TabList>

      {/* Tab Content */}
      <div
        style={{
          padding: "20px",
          backgroundColor: "#fff",
          border: "1px solid #dee2e6",
          borderRadius: "8px",
          minHeight: "300px",
        }}
      >
        <Routes>
          <Route
            route={ADMIN_ANALYTICS_ROUTE}
            routeParams={{ tab: "overview" }}
            element={<AnalyticsTabOverview />}
          />
          <Route
            route={ADMIN_ANALYTICS_ROUTE}
            routeParams={{ tab: "details" }}
            element={<AnalyticsTabDetails />}
          />
        </Routes>
      </div>
    </div>
  );
};
const AnalyticsTabOverview = () => {
  return (
    <div>
      <h4>Analytics Overview</h4>
      <p>High-level metrics and key performance indicators.</p>
      <div
        style={{
          marginTop: "20px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
          gap: "15px",
        }}
      >
        <div
          style={{
            padding: "15px",
            backgroundColor: "#e3f2fd",
            borderRadius: "8px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "24px",
              fontWeight: "bold",
              color: "#1976d2",
            }}
          >
            1,234
          </div>
          <div style={{ fontSize: "14px", color: "#666" }}>Total Users</div>
        </div>
        <div
          style={{
            padding: "15px",
            backgroundColor: "#e8f5e8",
            borderRadius: "8px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "24px",
              fontWeight: "bold",
              color: "#388e3c",
            }}
          >
            567
          </div>
          <div style={{ fontSize: "14px", color: "#666" }}>Active Sessions</div>
        </div>
        <div
          style={{
            padding: "15px",
            backgroundColor: "#fff3e0",
            borderRadius: "8px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              fontSize: "24px",
              fontWeight: "bold",
              color: "#f57c00",
            }}
          >
            89%
          </div>
          <div style={{ fontSize: "14px", color: "#666" }}>Satisfaction</div>
        </div>
      </div>
    </div>
  );
};
const AnalyticsTabDetails = () => {
  return (
    <div>
      <h4>Detailed Analytics</h4>
      <p>Comprehensive data and detailed breakdowns.</p>
      <div style={{ marginTop: "20px" }}>
        <div style={{ marginBottom: "20px" }}>
          <h5 style={{ marginBottom: "10px" }}>Traffic Sources</h5>
          <div
            style={{
              backgroundColor: "#f8f9fa",
              padding: "15px",
              borderRadius: "8px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "8px",
              }}
            >
              <span>Direct</span>
              <span>45%</span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "8px",
              }}
            >
              <span>Search Engines</span>
              <span>32%</span>
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: "8px",
              }}
            >
              <span>Social Media</span>
              <span>15%</span>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between" }}>
              <span>Referrals</span>
              <span>8%</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

render(<App />, document.getElementById("app"));
