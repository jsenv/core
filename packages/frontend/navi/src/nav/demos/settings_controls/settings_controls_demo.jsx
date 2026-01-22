import { render } from "preact";

import {
  Input,
  Route,
  RouteLink,
  Routes,
  setupRoutes,
  stateSignal,
  TabList,
} from "@jsenv/navi";

// Signals for navigation
const sectionSignal = stateSignal("preferences", {
  id: "section",
  oneOf: ["preferences", "profile"],
  persists: true,
});
const preferencesTabSignal = stateSignal("display", {
  id: "preferences_tab",
  oneOf: ["display", "notifications"],
  persists: true,
});
// Signals for form controls in URL search params
const brightnessSignal = stateSignal(75, {
  id: "brightness",
  type: "number",
  persists: true,
});
const darkModeSignal = stateSignal(false, {
  id: "dark_mode",
  type: "boolean",
  persists: true,
});

const {
  HOME_ROUTE,
  SETTINGS_ROUTE,
  SETTINGS_PREFERENCES_ROUTE,
  SETTINGS_PROFILE_ROUTE,
} = setupRoutes({
  HOME_ROUTE: "/",
  SETTINGS_ROUTE: `/settings/:section=${sectionSignal}/`,
  SETTINGS_PREFERENCES_ROUTE: `/settings/preferences/:tab=${preferencesTabSignal}?brightness=${brightnessSignal}&dark_mode=${darkModeSignal}`,
  SETTINGS_PROFILE_ROUTE: `/settings/profile`,
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
        <TabList.Tab route={SETTINGS_ROUTE}>Settings</TabList.Tab>
      </TabList>

      <div style={{ marginTop: "20px" }}>
        <Routes>
          <Route route={HOME_ROUTE} element={<HomePage />} />
          <Route route={SETTINGS_ROUTE} element={<SettingsPage />} />
        </Routes>
      </div>
    </div>
  );
};

const HomePage = () => {
  return (
    <div>
      <h2>Settings Controls Demo</h2>
      <p>
        This demo shows how to use input controls (range and checkbox) that sync
        with URL search parameters. Navigate to Settings → Preferences → Display
        to see the controls in action.
      </p>
      <div style={{ marginTop: "20px" }}>
        <RouteLink
          route={SETTINGS_PREFERENCES_ROUTE}
          routeParams={{ tab: "display" }}
        >
          Go to Display Settings →
        </RouteLink>
      </div>
    </div>
  );
};

const SettingsPage = () => {
  return (
    <div style={{ display: "flex", gap: "20px" }}>
      {/* Side Menu */}
      <div
        style={{
          minWidth: "200px",
          backgroundColor: "#f8f9fa",
          border: "1px solid #dee2e6",
          borderRadius: "8px",
          padding: "15px",
        }}
      >
        <h3 style={{ marginTop: 0, marginBottom: "15px", fontSize: "16px" }}>
          Settings Menu
        </h3>

        <TabList vertical>
          <TabList.Tab
            route={SETTINGS_PREFERENCES_ROUTE}
            expandX
            borderRadius="s"
            paddingLeft="s"
          >
            🎨 Preferences
          </TabList.Tab>
          <TabList.Tab
            route={SETTINGS_PROFILE_ROUTE}
            expandX
            borderRadius="s"
            paddingLeft="s"
          >
            👤 Profile
          </TabList.Tab>
        </TabList>
      </div>

      {/* Main Content Area */}
      <div style={{ flex: 1 }}>
        <Routes>
          <Route
            route={SETTINGS_PREFERENCES_ROUTE}
            element={<PreferencesPanel />}
          />
          <Route route={SETTINGS_PROFILE_ROUTE} element={<ProfilePanel />} />
        </Routes>
      </div>
    </div>
  );
};

const PreferencesPanel = () => {
  return (
    <div>
      <h3>Preferences</h3>

      {/* Horizontal Tabs */}
      <TabList style={{ marginBottom: "20px" }}>
        <TabList.Tab
          route={SETTINGS_PREFERENCES_ROUTE}
          routeParams={{ tab: "display" }}
        >
          Display
        </TabList.Tab>
        <TabList.Tab
          route={SETTINGS_PREFERENCES_ROUTE}
          routeParams={{ tab: "notifications" }}
        >
          Notifications
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
            route={SETTINGS_PREFERENCES_ROUTE}
            routeParams={{ tab: "display" }}
            element={<DisplayTabContent />}
          />
          <Route
            route={SETTINGS_PREFERENCES_ROUTE}
            routeParams={{ tab: "notifications" }}
            element={<NotificationsTabContent />}
          />
        </Routes>
      </div>
    </div>
  );
};

const DisplayTabContent = () => {
  return (
    <div>
      <h4>Display Settings</h4>
      <p>
        Configure your display preferences. These settings are synced with URL
        parameters.
      </p>

      <div
        style={{
          marginTop: "30px",
          display: "flex",
          flexDirection: "column",
          gap: "25px",
        }}
      >
        {/* Brightness Range Input */}
        <div>
          <label
            style={{
              display: "block",
              marginBottom: "10px",
              fontWeight: "bold",
              fontSize: "14px",
            }}
          >
            Brightness: {brightnessSignal.value}%
          </label>
          <Input
            type="range"
            min="0"
            max="100"
            value={brightnessSignal.value}
            action={(value) => {
              brightnessSignal.value = value;
            }}
            style={{
              width: "100%",
              maxWidth: "300px",
            }}
          />
          <div style={{ fontSize: "12px", color: "#666", marginTop: "5px" }}>
            Adjust the screen brightness level (0-100%)
          </div>
        </div>

        {/* Dark Mode Checkbox */}
        <div>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              fontWeight: "bold",
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            <Input
              type="checkbox"
              checked={darkModeSignal.value}
              action={(value) => {
                darkModeSignal.value = value;
              }}
              style={{ marginRight: "8px" }}
            />
            Enable Dark Mode
          </label>
          <div
            style={{
              fontSize: "12px",
              color: "#666",
              marginTop: "5px",
              marginLeft: "24px",
            }}
          >
            Switch between light and dark theme
          </div>
        </div>

        {/* Current URL Display */}
        <div
          style={{
            marginTop: "30px",
            padding: "15px",
            backgroundColor: "#f8f9fa",
            border: "1px solid #dee2e6",
            borderRadius: "6px",
          }}
        >
          <strong>Current URL parameters:</strong>
          <div
            style={{
              fontFamily: "monospace",
              fontSize: "12px",
              marginTop: "8px",
              wordBreak: "break-all",
            }}
          >
            brightness={brightnessSignal.value}&dark_mode={darkModeSignal.value}
          </div>
          <div style={{ fontSize: "11px", color: "#666", marginTop: "5px" }}>
            These values are automatically synced with the URL as you change the
            controls
          </div>
        </div>

        {/* Live Preview */}
        <div
          style={{
            marginTop: "20px",
            padding: "20px",
            backgroundColor: darkModeSignal.value ? "#2d3748" : "#ffffff",
            color: darkModeSignal.value ? "#ffffff" : "#000000",
            border: `2px solid ${darkModeSignal.value ? "#4a5568" : "#e2e8f0"}`,
            borderRadius: "8px",
            filter: `brightness(${brightnessSignal.value}%)`,
            transition: "all 0.3s ease",
          }}
        >
          <h5 style={{ marginTop: 0 }}>Live Preview</h5>
          <p style={{ margin: "10px 0" }}>
            This preview updates in real-time as you adjust the controls above.
          </p>
          <p style={{ margin: 0, fontSize: "12px", opacity: 0.8 }}>
            Dark mode: {darkModeSignal.value ? "ON" : "OFF"} | Brightness:{" "}
            {brightnessSignal.value}%
          </p>
        </div>
      </div>
    </div>
  );
};

const NotificationsTabContent = () => {
  return (
    <div>
      <h4>Notification Settings</h4>
      <p>Configure how and when you receive notifications.</p>
      <div style={{ marginTop: "20px" }}>
        <div style={{ marginBottom: "15px" }}>
          <label
            style={{ display: "flex", alignItems: "center", cursor: "pointer" }}
          >
            <input type="checkbox" style={{ marginRight: "8px" }} />
            Email notifications
          </label>
        </div>
        <div style={{ marginBottom: "15px" }}>
          <label
            style={{ display: "flex", alignItems: "center", cursor: "pointer" }}
          >
            <input type="checkbox" style={{ marginRight: "8px" }} />
            Push notifications
          </label>
        </div>
        <div style={{ marginBottom: "15px" }}>
          <label
            style={{ display: "flex", alignItems: "center", cursor: "pointer" }}
          >
            <input type="checkbox" style={{ marginRight: "8px" }} />
            SMS notifications
          </label>
        </div>
      </div>
    </div>
  );
};

const ProfilePanel = () => {
  return (
    <div>
      <h3>Profile</h3>
      <div
        style={{
          padding: "20px",
          backgroundColor: "#fff",
          border: "1px solid #dee2e6",
          borderRadius: "8px",
          minHeight: "300px",
        }}
      >
        <h4>User Profile</h4>
        <p>Manage your personal information and account settings.</p>
        <div style={{ marginTop: "20px" }}>
          <div style={{ marginBottom: "15px" }}>
            <label
              style={{
                display: "block",
                marginBottom: "5px",
                fontWeight: "bold",
              }}
            >
              Full Name:
            </label>
            <input
              type="text"
              placeholder="Enter your full name"
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
              Email:
            </label>
            <input
              type="email"
              placeholder="Enter your email"
              style={{
                width: "100%",
                maxWidth: "300px",
                padding: "8px",
                border: "1px solid #ccc",
                borderRadius: "4px",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

const container = document.getElementById("root");
render(<App />, container);
