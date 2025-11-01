# Routes API

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

## Why this separation?

### 1. **Technical requirement**

All routes must be defined at once for the routing system to work correctly (URL matching, navigation, etc.).

### 2. **Architectural choice: separating definition from usage**

Beyond this technical requirement, we choose to separate route definition from their UI usage. This separation provides several benefits:

#### **Clean overview of all routes**

All application routes are visible at a glance without superfluous noise. This gives developers a clear map of the entire application structure in one place.

#### **Route usage outside of UI components**

Route objects can be used anywhere in the application, not just in components:

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

#### **Discoverability through named exports**

Using named exports makes it immediately clear which routes each file uses:

```jsx
// ✅ Clearly shows which routes this file uses
import { HOME_ROUTE, PROFILE_ROUTE } from "./routes.js";

// ❌ Have to read the file to know which routes are used
import { ROUTES } from "./routes.js";
```
