# Routes API

## Technical requirement

All routes must be defined at once for the routing system to work correctly (URL matching, navigation, etc.).

## Overview

The routing API is divided into two distinct parts:

1. **`setupRoutes()`** - Defines all application routes
2. **`<Route>`** - Uses routes to display conditional content

```jsx
// 1. Route definition (typically in routes.js)
import { setupRoutes } from "@jsenv/navi";

export const {
  HOME_ROUTE,
  AUTH_ROUTE,
  LOGIN_ROUTE,
  FORGOT_PASSWORD_ROUTE,
  ONE_MORE_ROUTE,
} = setupRoutes({
  HOME_ROUTE: "/",
  AUTH_ROUTE: "/auth/",
  LOGIN_ROUTE: "/auth/login",
  FORGOT_PASSWORD_ROUTE: "/auth/forgot_password",
  ONE_MORE_ROUTE: "/one_more/",
});
```

```jsx
// 2. Route usage (in components)
import { Route } from "@jsenv/navi";
import { HOME_ROUTE, LOGIN_ROUTE, FORGOT_PASSWORD_ROUTE } from "./routes.js";

export const App = () => {
  return (
    <>
      <Route route={HOME_ROUTE}>Homepage</Route>
      <Route>
        <div>
          <Route route={LOGIN_ROUTE}>Login</Route>
          <Route route={FORGOT_PASSWORD_ROUTE}>Forgot password</Route>
        </div>
      </Route>
    </>
  );
};
```

## Data Loading with Routes

Routes can load data asynchronously using the `action` prop. This enables data fetching that integrates seamlessly with Suspense and Error Boundary patterns:

```jsx
import { Suspense } from "preact/compat";
import { ErrorBoundary } from "@jsenv/navi";

// Data loading function
const loadUserProfile = async ({ userId }) => {
  const response = await fetch(`/api/users/${userId}`);
  if (!response.ok) {
    throw new Error("Failed to load user profile");
  }
  return response.json();
};

export const App = () => {
  return (
    <ErrorBoundary fallback={<div>Something went wrong</div>}>
      <Suspense fallback={<div>Loading...</div>}>
        <Route route={PROFILE_ROUTE} action={loadUserProfile}>
          {(userData) => (
            <div>
              <h1>{userData.name}</h1>
              <p>{userData.email}</p>
            </div>
          )}
        </Route>
      </Suspense>
    </ErrorBoundary>
  );
};
```

### Data Loading Patterns

#### **Basic Data Loading**

```jsx
// Simple data fetch
<Route
  route={USERS_ROUTE}
  action={async () => {
    const response = await fetch("/api/users");
    return response.json();
  }}
>
  {(users) => <UserList users={users} />}
</Route>
```

#### **Route Parameters in Data Loading**

```jsx
// Using route parameters for data fetching
<Route
  route={USER_DETAIL_ROUTE} // e.g., "/users/:userId"
  action={async ({ userId }) => {
    const response = await fetch(`/api/users/${userId}`);
    return response.json();
  }}
>
  {(user) => <UserProfile user={user} />}
</Route>
```

#### **Error Handling**

```jsx
// Wrap routes in ErrorBoundary to handle failures
<ErrorBoundary
  fallback={({ error, resetError }) => (
    <div>
      <p>Error: {error.message}</p>
      <button onClick={resetError}>Retry</button>
    </div>
  )}
>
  <Route route={API_ROUTE} action={riskyApiCall}>
    {(data) => <ApiData data={data} />}
  </Route>
</ErrorBoundary>
```

#### **Loading States**

```jsx
// Wrap routes in Suspense to show loading states
<Suspense
  fallback={
    <div className="loading">
      <Spinner />
      <p>Loading data...</p>
    </div>
  }
>
  <Route route={DASHBOARD_ROUTE} action={loadDashboardData}>
    {(dashboardData) => <Dashboard data={dashboardData} />}
  </Route>
</Suspense>
```

## Why this separation?

This separation is an architectural choice in order to be able to use route outside of UI components:

```jsx
// Programmatic navigation
import { LOGIN_ROUTE, PROFILE_ROUTE } from "./routes.js";

// Redirect after login
const redirectAfterLogin = () => {
  window.location.href = PROFILE_ROUTE.buildUrl({ userId: "123" });
};

// URL construction for links
const shareProfileLink = (userId) => {
  return PROFILE_ROUTE.buildUrl({ userId });
};

// Route validation in business logic
const isUserOnAuthPage = (currentUrl) => {
  return LOGIN_ROUTE.matches(currentUrl);
};
```

Routes can also be associated with logic before JSX components are even involved. This will enable implementing component preloading, data prefetching, performance optimizations, etc.

## Other architectural choices

#### **Clean overview of all routes**

All application routes are visible at a glance without superfluous noise. This gives developers a clear map of the entire application structure in one place.

#### **Discoverability through named exports**

Using named exports makes it immediately clear which routes each file uses:

```jsx
// ✅ Clearly shows which routes this file uses
import { HOME_ROUTE, PROFILE_ROUTE } from "./routes.js";

// ❌ Have to read the file to know which routes are used
import { ROUTES } from "./routes.js";
```
