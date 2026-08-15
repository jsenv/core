## Swiping between routes

When the tabs of a page are URLs, `RouteTravel` lets a thumb drag from one to
the next. The router still mounts only the branch that matches — the page being
left is shown from the picture the browser keeps of it, not from a second
mounted route.

```jsx
<SectionNav />
<RouteTravel>
  <Route>
    <Route route={UPCOMING_ROUTE} element={UpcomingPage} />
    <Route route={REQUESTS_ROUTE} element={RequestsPage} />
    <Route route={FINISHED_ROUTE} element={FinishedPage} />
  </Route>
</RouteTravel>;
```

The order of the tabs — what "one step that way" means, and something no URL
says — is read from the children, in the order they are written. Pass `routes`
only to say another order, or when the pages are not children of the box.

Every change between those routes travels, not only a drag: a tab pressed, a
key, the browser's back button. What a finger adds is that it drives the
movement itself and can change its mind before letting go.

A swipe **replaces** the current history entry (a gesture browses; a tab pressed
aims at a place and pushes, which is what its `<Link>` already does). Pass
`onTravel` to decide otherwise.

The page arriving mounts during the gesture and fills in under the finger, so it
is dragged in as its own loading state. Anything outside the box that must
follow the gesture — the trait under the tab row — takes a
`view-transition-name` of its own and is animated on the same clock.

Demo: [demos/route_travel/route_travel.html](./demos/route_travel/route_travel.html).

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
    <Route
      route={PROFILE_ROUTE}
      action={loadUserProfile}
      element={(userData) => (
        <div>
          <h1>{userData.name}</h1>
          <p>{userData.email}</p>
        </div>
      )}
    />
  );
};
```

#### Loading State

Wrap routes in Suspense to show loading states

```jsx
import { Suspense } from "preact/compat";

<Suspense fallback={<p>Loading...</p>}>
  <Route
    route={DASHBOARD_ROUTE}
    action={loadDashboardData}
    element={(dashboardData) => <Dashboard data={dashboardData} />}
  />
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
  <Route
    route={API_ROUTE}
    action={riskyApiCall}
    element={(data) => <ApiData data={data} />}
  />
</ErrorBoundary>;
```
