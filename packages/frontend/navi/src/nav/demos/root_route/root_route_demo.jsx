import { render } from "preact";

import { Route, Routes, setupRoutes, TabList } from "@jsenv/navi";

const {
  HOME_ROUTE,
  // OTHER_ROUTE
} = setupRoutes({
  HOME_ROUTE: "/",
  // OTHER_ROUTE: "/other",
});

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
      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: "8px",
          padding: "20px",
          marginTop: "20px",
        }}
      >
        <TabList>
          <TabList.Tab route={HOME_ROUTE}>Home</TabList.Tab>
          {/* <TabList.Tab route={OTHER_ROUTE}>Other</TabList.Tab> */}
        </TabList>

        <Routes>
          <Route route={HOME_ROUTE} element={"Home"} />
          {/* <Route route={OTHER_ROUTE} element={"Other"} /> */}
        </Routes>
      </div>
    </div>
  );
};

render(<App />, document.getElementById("app"));
