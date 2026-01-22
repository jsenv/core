import { render } from "preact";

import {
  Box,
  Button,
  MessageBox,
  Route,
  RouteLink,
  Routes,
  setupRoutes,
  stateSignal,
  TabList,
} from "@jsenv/navi";

const cities = ["Paris", "London", "Tokyo", "New York", "Sydney"];
const citySignal = stateSignal(undefined, {
  id: "city",
  persists: true,
  enum: cities,
});
const { HOME_ROUTE, SELECT_CITY_ROUTE, MAP_ROUTE } = setupRoutes({
  HOME_ROUTE: "/",
  SELECT_CITY_ROUTE: "/select_city",
  MAP_ROUTE: `/map?city=${citySignal}`,
});

const App = () => {
  return (
    <div
      style={{
        fontFamily: "Arial, sans-serif",
        maxWidth: "600px",
        margin: "0 auto",
        padding: "20px",
      }}
    >
      <TabList>
        <TabList.Tab route={HOME_ROUTE}>Home</TabList.Tab>
        <TabList.Tab route={SELECT_CITY_ROUTE}>Select City</TabList.Tab>
        <TabList.Tab route={MAP_ROUTE}>Map</TabList.Tab>
      </TabList>

      <div style={{ marginTop: "20px" }}>
        <Routes>
          <Route route={HOME_ROUTE} element={<HomePage />} />
          <Route route={SELECT_CITY_ROUTE} element={<SelectCityPage />} />
          <Route route={MAP_ROUTE} element={<MapPage />} />
        </Routes>
      </div>
    </div>
  );
};

const HomePage = () => {
  return (
    <div>
      <h2>Welcome to the City Demo</h2>
      <p>Navigate to select a city or view your selected city.</p>
      <div style={{ marginTop: "15px" }}>
        <RouteLink
          route={SELECT_CITY_ROUTE}
          style={{
            padding: "10px 20px",
            backgroundColor: "#007bff",
            color: "white",
            textDecoration: "none",
            borderRadius: "4px",
            display: "inline-block",
          }}
        >
          Go to City Selection
        </RouteLink>
      </div>
    </div>
  );
};

const SelectCityPage = () => {
  const currentCity = citySignal.value;
  const currentCityInvalid = !citySignal.validity.valid;

  return (
    <div>
      <h2>Select a City</h2>

      {currentCityInvalid && (
        <MessageBox status="warning">
          The city {currentCity} is invalid.
        </MessageBox>
      )}

      <p>Choose a city from the list below:</p>

      <Box column marginTop="m" spacing="s">
        <div>
          {cities.map((city) => (
            <div key={city} style={{ marginBottom: "10px" }}>
              <RouteLink
                route={MAP_ROUTE}
                routeParams={{ city }}
                style={{
                  padding: "8px 16px",
                  backgroundColor: currentCity === city ? "grey" : "#28a745",
                  color: "white",
                  textDecoration: "none",
                  borderRadius: "4px",
                  display: "inline-block",
                  minWidth: "120px",
                  textAlign: "center",
                }}
              >
                {city}
              </RouteLink>
            </div>
          ))}
        </div>

        <div>
          <RouteLink
            route={MAP_ROUTE}
            routeParams={{ city: "toto" }}
            style={{
              padding: "8px 16px",
              backgroundColor: "grey",
              color: "white",
              textDecoration: "none",
              borderRadius: "4px",
              display: "inline-block",
              minWidth: "120px",
              textAlign: "center",
            }}
          >
            Toto
          </RouteLink>
        </div>
      </Box>
    </div>
  );
};

const MapPage = () => {
  const city = citySignal.value;

  // If no city is selected, redirect to city selection
  if (!city || !citySignal.validity.valid) {
    SELECT_CITY_ROUTE.redirectTo();
    return <div>Redirecting to city selection...</div>;
  }

  return (
    <div>
      <h2>Selected City</h2>
      <div
        style={{
          padding: "20px",
          backgroundColor: "#f8f9fa",
          borderRadius: "8px",
          border: "2px solid #007bff",
        }}
      >
        <h3 style={{ color: "#007bff", marginTop: 0 }}>🏙️ {city}</h3>
        <p>
          You have selected <strong>{city}</strong> as your city!
        </p>
      </div>

      <div style={{ marginTop: "20px" }}>
        <RouteLink
          route={SELECT_CITY_ROUTE}
          style={{
            padding: "8px 16px",
            backgroundColor: "#6c757d",
            color: "white",
            textDecoration: "none",
            borderRadius: "4px",
            marginRight: "10px",
          }}
        >
          Select Different City
        </RouteLink>

        <Button
          action={() => {
            citySignal.value = "London";
          }}
        >
          Set City to London
        </Button>

        <RouteLink
          route={HOME_ROUTE}
          style={{
            padding: "8px 16px",
            backgroundColor: "#17a2b8",
            color: "white",
            textDecoration: "none",
            borderRadius: "4px",
          }}
        >
          Back to Home
        </RouteLink>
      </div>
    </div>
  );
};

render(<App />, document.getElementById("app"));
