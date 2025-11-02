import { Route, RouteLink, Routes, setupRoutes } from "@jsenv/navi";

// Routes setup with nested structure
const {
  HOME_ROUTE,
  ADMIN_ROUTE,
  ADMIN_USERS_ROUTE,
  ADMIN_USERS_LIST_ROUTE,
  ADMIN_USERS_CREATE_ROUTE,
} = setupRoutes({
  HOME_ROUTE: "home",
  ADMIN_ROUTE: "admin/",
  ADMIN_USERS_ROUTE: "admin/users/",
  ADMIN_USERS_LIST_ROUTE: "admin/users/list",
  ADMIN_USERS_CREATE_ROUTE: "admin/users/create",
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
      </div>

      <main>
        <Routes>
          {/* Simple routes (no nesting) */}
          <Route
            route={HOME_ROUTE}
            element={<div id="home-element">🏠 Homepage</div>}
          />

          {/* LEVEL 1: Admin wrapper - wraps all admin routes */}
          <Route
            route={ADMIN_ROUTE}
            element={
              <div id="admin-element">
                🛡️ Admin Panel
                <Route.Slot />
              </div>
            }
          >
            {/* LEVEL 2: Users section wrapper */}
            <Route
              route={ADMIN_USERS_ROUTE}
              element={
                <div id="users-element">
                  👥 Users Section
                  <Route.Slot />
                </div>
              }
            >
              {/* LEVEL 3: Specific user pages */}
              <Route
                route={ADMIN_USERS_LIST_ROUTE}
                element={<div id="users-list-element">📋 Users List</div>}
              />

              <Route
                route={ADMIN_USERS_CREATE_ROUTE}
                element={<div id="users-create-element">➕ Create User</div>}
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
