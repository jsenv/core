import { Route, RouteLink, Routes } from "@jsenv/navi";
import { Suspense } from "preact/compat";
import { Map } from "./map.jsx";
import { MAP_ROUTE } from "./routes.js";

const Router = () => {
  return (
    <Routes>
      <Route route={MAP_ROUTE} element={<Map />}></Route>
    </Routes>
  );
};

export const App = () => {
  return (
    <div id="app">
      <h1>Double Nesting Route Test</h1>

      <div className="nav">
        <RouteLink route={MAP_ROUTE}>Map</RouteLink>
      </div>

      <main>
        <Suspense>
          <Router />
        </Suspense>
      </main>
    </div>
  );
};
