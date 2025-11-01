```jsx
import { Route } from "@jsenv/navi";

const HOME_ROUTE = route("/");
const LOGIN_ROUTE = route("/login");
const FORGOT_PASSWORD = route("/forgot_password");

export const App = () => {
  return (
    <>
      <Route route={HOME_ROUTE}>Homepage</Route>
      <Route>
        <div>
          <Route route={LOGIN_ROUTE}>Login</Route>
          <Route route={FORGOT_PASSWORD}>Forgot password</Route>
        </div>
      </Route>
    </>
  );
};
```
