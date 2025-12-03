import { render } from "preact";

import {
  Route,
  Routes,
  setupRoutes,
  TabList,
  useUrlSearchParam,
} from "@jsenv/navi";

// Setup nested routes
const { HOME_ROUTE, PARENT_ROUTE, CHILD_A_ROUTE, CHILD_B_ROUTE } = setupRoutes({
  HOME_ROUTE: "/",
  PARENT_ROUTE: "/parent",
  CHILD_A_ROUTE: "/parent/child-a",
  CHILD_B_ROUTE: "/parent/child-b",
});

// Home page component
const HomePage = () => {
  return (
    <div>
      <h2>Home</h2>
      <p>
        Navigate to the parent page to see how child routes inherit search
        parameters.
      </p>
    </div>
  );
};

// Parent page component
const ParentPage = () => {
  const [category] = useUrlSearchParam("category");

  return (
    <div>
      <h2>Parent Page</h2>
      <p>
        Category: <strong>{category}</strong>
      </p>

      <h3>Child Pages</h3>
      <p>Both children will inherit the current category parameter:</p>
      <TabList spacing="sm">
        <TabList.Tab route={CHILD_A_ROUTE} routeParams={{ category }}>
          Child A
        </TabList.Tab>
        <TabList.Tab route={CHILD_B_ROUTE} routeParams={{ category }}>
          Child B
        </TabList.Tab>
      </TabList>
    </div>
  );
};

// Child A page component
const ChildAPage = () => {
  const [category] = useUrlSearchParam("category");

  return (
    <div>
      <h2>Child A</h2>
      <p>
        Inherited category: <strong>{category}</strong>
      </p>
      <p>This page uses the search parameter from the parent route.</p>
    </div>
  );
};

// Child B page component
const ChildBPage = () => {
  const [category] = useUrlSearchParam("category");

  return (
    <div>
      <h2>Child B</h2>
      <p>
        Inherited category: <strong>{category}</strong>
      </p>
      <p>This page also uses the search parameter from the parent route.</p>
    </div>
  );
};

const App = () => {
  return (
    <div
      style={{
        fontFamily: "Arial, sans-serif",
        maxWidth: "800px",
        margin: "0 auto",
        padding: "20px",
      }}
    >
      <h1>Nested Parameters Demo</h1>
      <p>Test how child routes inherit parent search parameters.</p>

      {/* Top level navigation - always available */}
      <div style={{ marginBottom: "20px" }}>
        <TabList spacing="sm">
          <TabList.Tab route={HOME_ROUTE}>Home</TabList.Tab>
          <TabList.Tab
            route={PARENT_ROUTE}
            routeParams={{ category: "products" }}
          >
            Parent (products)
          </TabList.Tab>
          <TabList.Tab
            route={PARENT_ROUTE}
            routeParams={{ category: "services" }}
          >
            Parent (services)
          </TabList.Tab>
        </TabList>
      </div>

      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: "8px",
          padding: "20px",
          backgroundColor: "#fafafa",
        }}
      >
        <Routes>
          <Route route={HOME_ROUTE} element={<HomePage />} />
          <Route route={PARENT_ROUTE} element={<ParentPage />} />
          <Route route={CHILD_A_ROUTE} element={<ChildAPage />} />
          <Route route={CHILD_B_ROUTE} element={<ChildBPage />} />
        </Routes>
      </div>
    </div>
  );
};

render(<App />, document.getElementById("app"));
