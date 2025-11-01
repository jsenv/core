```jsx
import { setupRoutes, Route } from "@jsenv/navi";

// Define all routes at once, but get individual exports for discoverability
export const { HOME_ROUTE, LOGIN_ROUTE, FORGOT_PASSWORD_ROUTE } = setupRoutes({
  HOME_ROUTE: "/",
  LOGIN_ROUTE: "/login",
  FORGOT_PASSWORD_ROUTE: "/forgot_password",
});

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
