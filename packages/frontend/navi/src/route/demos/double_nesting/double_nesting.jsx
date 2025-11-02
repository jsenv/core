import { Route, RouteLink, Routes, setupRoutes } from "@jsenv/navi";
import { useLayoutEffect } from "preact/hooks";

// External state to track renders across mount/unmount cycles
const componentStats = new Map();

const getComponentStats = (name) => {
  if (!componentStats.has(name)) {
    componentStats.set(name, { renders: 0, layoutEffects: 0 });
  }
  return componentStats.get(name);
};

// Simple component tracker
const ComponentTracker = ({ name, color = "#333", children }) => {
  const stats = getComponentStats(name);
  stats.renders++;

  useLayoutEffect(() => {
    stats.layoutEffects++;
  });

  return (
    <div
      style={{
        background: color,
        color: "white",
        padding: "8px",
        margin: "5px 0",
        borderRadius: "4px",
      }}
    >
      <div style={{ fontSize: "12px", marginBottom: "5px" }}>
        <strong>{name}</strong> - Renders: {stats.renders} | LayoutEffects:{" "}
        {stats.layoutEffects}
      </div>
      {children}
    </div>
  );
};

// Routes setup with nested structure
const {
  HOME_ROUTE,
  ADMIN_USERS_LIST_ROUTE,
  ADMIN_USERS_CREATE_ROUTE,
  ADMIN_SETTINGS_GENERAL_ROUTE,
  ADMIN_SETTINGS_SECURITY_ROUTE,
} = setupRoutes({
  HOME_ROUTE: "home",
  ADMIN_USERS_LIST_ROUTE: "admin/users/list",
  ADMIN_USERS_CREATE_ROUTE: "admin/users/create",
  ADMIN_SETTINGS_GENERAL_ROUTE: "admin/settings/general",
  ADMIN_SETTINGS_SECURITY_ROUTE: "admin/settings/security",
});

export const App = () => {
  console.debug("🚀 App component rendering...");

  return (
    <div>
      <h1>Double Nesting Route Test</h1>

      <div className="debug">
        <h3>🔍 Double Nesting Structure</h3>
        <p>This demo tests three levels of route nesting:</p>
        <ul>
          <li>
            <strong>Level 1:</strong> Admin wrapper (wraps all admin routes)
          </li>
          <li>
            <strong>Level 2:</strong> Section wrappers (Users, Settings)
          </li>
          <li>
            <strong>Level 3:</strong> Specific pages (List, Create, General,
            Security)
          </li>
        </ul>
      </div>

      {/* Navigation */}
      <div className="nav">
        <RouteLink route={HOME_ROUTE}>🏠 Home</RouteLink>
        <hr />
        <RouteLink route={ADMIN_USERS_LIST_ROUTE}>👥 Users List</RouteLink>
        <RouteLink route={ADMIN_USERS_CREATE_ROUTE}>➕ Create User</RouteLink>
        <RouteLink route={ADMIN_SETTINGS_GENERAL_ROUTE}>
          ⚙️ General Settings
        </RouteLink>
        <RouteLink route={ADMIN_SETTINGS_SECURITY_ROUTE}>
          🔒 Security Settings
        </RouteLink>
      </div>

      <main>
        <Routes>
          {/* Simple routes (no nesting) */}
          <Route
            route={HOME_ROUTE}
            element={
              <div
                style="background: #e8f5e8; padding: 15px; border-radius: 5px;"
                className="level-1"
              >
                <h3>🏠 Homepage</h3>
                <ComponentTracker name="HomePage" color="#28a745" />
                <p>Welcome to the homepage!</p>
              </div>
            }
          />

          {/* LEVEL 1: Admin wrapper - wraps all admin routes */}
          <Route
            element={
              <div
                style="background: #f8f9fa; padding: 20px; border-radius: 8px; border: 2px solid #6c757d;"
                className="level-1"
              >
                <h2>🛡️ Admin Panel (Level 1)</h2>
                <ComponentTracker name="AdminWrapper" color="#6c757d" />
                <p>
                  <em>
                    This wrapper appears for all admin routes. Current nested
                    content:
                  </em>
                </p>
                <div style="border: 1px dashed #6c757d; padding: 10px; margin: 10px 0;">
                  <Route.Slot />
                </div>
                <p>
                  <em>End of admin panel wrapper</em>
                </p>
              </div>
            }
          >
            {/* LEVEL 2: Users section wrapper */}
            <Route
              element={
                <div
                  style="background: #d4edda; padding: 15px; border-radius: 6px; border: 2px solid #28a745;"
                  className="level-2"
                >
                  <h3>👥 Users Section (Level 2)</h3>
                  <ComponentTracker name="UsersWrapper" color="#28a745" />
                  <p>User management tools:</p>
                  <div style="border: 1px dashed #28a745; padding: 10px; margin: 10px 0;">
                    <Route.Slot />
                  </div>
                </div>
              }
            >
              {/* LEVEL 3: Specific user pages */}
              <Route
                route={ADMIN_USERS_LIST_ROUTE}
                element={
                  <div
                    style="background: #cce5ff; padding: 10px; border-radius: 4px;"
                    className="level-3"
                  >
                    <h4>📋 Users List (Level 3)</h4>
                    <ComponentTracker name="UsersListPage" color="#007bff" />
                    <p>List of all users in the system.</p>
                    <ul>
                      <li>John Doe</li>
                      <li>Jane Smith</li>
                      <li>Bob Wilson</li>
                    </ul>
                  </div>
                }
              />

              <Route
                route={ADMIN_USERS_CREATE_ROUTE}
                element={
                  <div
                    style="background: #fff3cd; padding: 10px; border-radius: 4px;"
                    className="level-3"
                  >
                    <h4>➕ Create User (Level 3)</h4>
                    <ComponentTracker name="CreateUserPage" color="#ffc107" />
                    <p>Form to create a new user.</p>
                    <form>
                      <input type="text" placeholder="Username" />
                      <input type="email" placeholder="Email" />
                      <button type="button">Create User</button>
                    </form>
                  </div>
                }
              />
            </Route>

            {/* LEVEL 2: Settings section wrapper */}
            <Route
              element={
                <div
                  style="background: #ffeaa7; padding: 15px; border-radius: 6px; border: 2px solid #fdcb6e;"
                  className="level-2"
                >
                  <h3>⚙️ Settings Section (Level 2)</h3>
                  <ComponentTracker name="SettingsWrapper" color="#fdcb6e" />
                  <p>Application settings:</p>
                  <div style="border: 1px dashed #fdcb6e; padding: 10px; margin: 10px 0;">
                    <Route.Slot />
                  </div>
                </div>
              }
            >
              {/* LEVEL 3: Specific settings pages */}
              <Route
                route={ADMIN_SETTINGS_GENERAL_ROUTE}
                element={
                  <div
                    style="background: #d1ecf1; padding: 10px; border-radius: 4px;"
                    className="level-3"
                  >
                    <h4>🔧 General Settings (Level 3)</h4>
                    <ComponentTracker
                      name="GeneralSettingsPage"
                      color="#17a2b8"
                    />
                    <p>General application configuration.</p>
                    <div>
                      <label>
                        <input type="checkbox" /> Enable notifications
                      </label>
                      <br />
                      <label>
                        <input type="checkbox" /> Dark mode
                      </label>
                    </div>
                  </div>
                }
              />

              <Route
                route={ADMIN_SETTINGS_SECURITY_ROUTE}
                element={
                  <div
                    style="background: #f8d7da; padding: 10px; border-radius: 4px;"
                    className="level-3"
                  >
                    <h4>🔒 Security Settings (Level 3)</h4>
                    <ComponentTracker
                      name="SecuritySettingsPage"
                      color="#dc3545"
                    />
                    <p>Security and authentication settings.</p>
                    <div>
                      <label>
                        <input type="checkbox" /> Two-factor authentication
                      </label>
                      <br />
                      <label>
                        <input type="checkbox" /> Session timeout
                      </label>
                    </div>
                  </div>
                }
              />
            </Route>
          </Route>
        </Routes>
      </main>

      <div className="debug">
        <h2>🧪 Testing Scenarios</h2>
        <ul>
          <li>
            <strong>Home (/):</strong> Only homepage content should be visible
            <br />
            Expected: HomePage renders only
          </li>
          <li>
            <strong>Profile (/profile):</strong> Only profile content should be
            visible
            <br />
            Expected: ProfilePage renders only
          </li>
          <li>
            <strong>Users List (/admin/users/list):</strong> All 3 levels should
            render
            <br />
            Expected: AdminWrapper → UsersWrapper → UsersListPage
          </li>
          <li>
            <strong>Create User (/admin/users/create):</strong> All 3 levels
            should render
            <br />
            Expected: AdminWrapper → UsersWrapper → CreateUserPage
          </li>
          <li>
            <strong>General Settings (/admin/settings/general):</strong> All 3
            levels should render
            <br />
            Expected: AdminWrapper → SettingsWrapper → GeneralSettingsPage
          </li>
          <li>
            <strong>Security Settings (/admin/settings/security):</strong> All 3
            levels should render
            <br />
            Expected: AdminWrapper → SettingsWrapper → SecuritySettingsPage
          </li>
        </ul>

        <h3>⚠️ What to watch for:</h3>
        <ul>
          <li>
            <strong>Proper nesting:</strong> Each level should only contain its
            direct children
          </li>
          <li>
            <strong>No DOM flash:</strong> Inactive routes should never appear
            in DOM
          </li>
          <li>
            <strong>Component isolation:</strong> Inactive wrappers should not
            render
          </li>
          <li>
            <strong>Performance:</strong> Only active path should have
            layoutEffects
          </li>
        </ul>

        <h3>📊 Component Stats:</h3>
        <p>
          <em>
            Check the browser console for render logs and observe the component
            stats above.
          </em>
        </p>
      </div>
    </div>
  );
};
