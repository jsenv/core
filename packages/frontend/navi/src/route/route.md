```jsx
import { route, Route } from "@jsenv/navi";

// Routes can be created individually as needed
const HOME_ROUTE = route("/");
const LOGIN_ROUTE = route("/login");
const FORGOT_PASSWORD_ROUTE = route("/forgot_password");

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
