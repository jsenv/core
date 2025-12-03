import { render } from "preact";

import {
  Route,
  Routes,
  setupRoutes,
  Tab,
  TabList,
  useUrlSearchParam,
} from "@jsenv/navi";

// Setup nested routes
const { HOME_ROUTE, CATALOG_ROUTE, PRODUCTS_ROUTE, REVIEWS_ROUTE } =
  setupRoutes({
    HOME_ROUTE: "/",
    CATALOG_ROUTE: "/catalog",
    PRODUCTS_ROUTE: "/catalog/products",
    REVIEWS_ROUTE: "/catalog/reviews",
  });

const HomePage = () => {
  return (
    <div>
      <h2>Home</h2>
      <p>
        Navigate to the catalog to see how sub-pages inherit search parameters.
      </p>
    </div>
  );
};
const CatalogPage = () => {
  const [category] = useUrlSearchParam("category");

  return (
    <div>
      <h2>Catalog</h2>
      <p>
        Category: <strong>{category || "all"}</strong>
      </p>

      <h3>Sections</h3>
      <p>Both sections will inherit the current category parameter:</p>
      <TabList spacing="sm">
        <Tab route={PRODUCTS_ROUTE} routeParams={{ category }}></Tab>
        <Tab route={REVIEWS_ROUTE} routeParams={{ category }}></Tab>
      </TabList>
    </div>
  );
};
const ProductsPage = () => {
  const [category] = useUrlSearchParam("category");

  return (
    <div>
      <h2>Products</h2>
      <p>
        Showing products for: <strong>{category || "all categories"}</strong>
      </p>
      <p>
        This page displays products filtered by the catalog's category
        parameter.
      </p>
    </div>
  );
};
const ReviewsPage = () => {
  const [category] = useUrlSearchParam("category");

  return (
    <div>
      <h2>Reviews</h2>
      <p>
        Showing reviews for: <strong>{category || "all categories"}</strong>
      </p>
      <p>
        This page displays reviews filtered by the catalog's category parameter.
      </p>
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
      <p>Test how sub-routes inherit parent search parameters.</p>

      {/* Top level navigation - always available */}
      <div style={{ marginBottom: "20px" }}>
        <TabList spacing="sm">
          <Tab route={HOME_ROUTE}>Home</Tab>
          <Tab
            route={CATALOG_ROUTE}
            routeParams={{ category: "electronics" }}
          ></Tab>
          <Tab route={CATALOG_ROUTE} routeParams={{ category: "books" }}></Tab>
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
          <Route route={CATALOG_ROUTE} element={<CatalogPage />} />
          <Route route={PRODUCTS_ROUTE} element={<ProductsPage />} />
          <Route route={REVIEWS_ROUTE} element={<ReviewsPage />} />
        </Routes>
      </div>
    </div>
  );
};

render(<App />, document.getElementById("app"));
