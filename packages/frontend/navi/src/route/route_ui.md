## Data Loading with Routes

Routes can load data asynchronously using the `action` prop.

```jsx
const loadUserProfile = async ({ userId }) => {
  const response = await fetch(`/api/users/${userId}`);
  if (!response.ok) {
    throw new Error("Failed to load user profile");
  }
  return response.json();
};

export const App = () => {
  return (
    <Route route={PROFILE_ROUTE} action={loadUserProfile}>
      {(userData) => (
        <div>
          <h1>{userData.name}</h1>
          <p>{userData.email}</p>
        </div>
      )}
    </Route>
  );
};
```

#### Loading State

Wrap routes in Suspense to show loading states

```jsx
import { Suspense } from "preact/compat";

<Suspense fallback={<p>Loading...</p>}>
  <Route route={DASHBOARD_ROUTE} action={loadDashboardData}>
    {(dashboardData) => <Dashboard data={dashboardData} />}
  </Route>
</Suspense>;
```

#### Error Handling

Wrap routes in ErrorBoundary to handle failures

```jsx
import { ErrorBoundary } from "@jsenv/navi";

<ErrorBoundary
  fallback={(error, { resetError }) => (
    <div>
      <p>Error: {error.message}</p>
      <button onClick={resetError}>Retry</button>
    </div>
  )}
>
  <Route route={API_ROUTE} action={riskyApiCall}>
    {(data) => <ApiData data={data} />}
  </Route>
</ErrorBoundary>;
```
