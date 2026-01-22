import { computed, effect } from "@preact/signals";
import { render } from "preact";

import {
  Box,
  Input,
  MessageBox,
  Paragraph,
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
  oneOf: cities,
});
const cityDataSignal = stateSignal(null);
const fetchCity = async (city) => {
  // Simulate API delay
  await new Promise((resolve) => setTimeout(resolve, 500));
  const { lon, lat } = CITY_COORDINATES[city];
  return { lon, lat };
};
effect(async () => {
  const city = citySignal.value;
  cityDataSignal.value = null;
  const cityData = await fetchCity(city);
  cityDataSignal.value = cityData;
});
// Fake coordinates for cities
const CITY_COORDINATES = {
  "Paris": { lon: 2.3522, lat: 48.8566 },
  "London": { lon: -0.1276, lat: 51.5074 },
  "Tokyo": { lon: 139.6917, lat: 35.6895 },
  "New York": { lon: -74.006, lat: 40.7128 },
  "Sydney": { lon: 151.2093, lat: -33.8688 },
};

const cityLongitudeSignal = computed(() => cityDataSignal.value?.lon);
const cityLatitudeSignal = computed(() => cityDataSignal.value?.lat);
const longitudeSignal = stateSignal(undefined, {
  id: "longitude",
  type: "float",
  persists: true,
  sourceSignal: cityLongitudeSignal,
  debug: true,
});
const latitudeSignal = stateSignal(undefined, {
  id: "latitude",
  type: "float",
  persists: true,
  sourceSignal: cityLatitudeSignal,
});

const { HOME_ROUTE, SELECT_CITY_ROUTE, MAP_ROUTE } = setupRoutes({
  HOME_ROUTE: "/",
  SELECT_CITY_ROUTE: "/select_city",
  MAP_ROUTE: `/map?city=${citySignal}&lon=${longitudeSignal}&lat=${latitudeSignal}`,
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
      <h2>City Map Demo</h2>
      <p>
        This demo shows how to work with city selection and coordinate mapping
        using URL parameters.
      </p>
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
          Start by Selecting a City
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

  return <MapWithCity />;
};
const MapWithCity = () => {
  const city = citySignal.value;
  const lon = longitudeSignal.value;
  const lat = latitudeSignal.value;
  const cityData = cityDataSignal.value;

  if (!cityData) {
    return (
      <div>
        <h2>Loading Map...</h2>
        <p>Fetching coordinates for {city}...</p>
      </div>
    );
  }
  return <MapWithCoordinates city={city} lon={lon} lat={lat} />;
};

const MapWithCoordinates = ({ city, lon, lat }) => {
  const cityLongitude = cityLongitudeSignal.value;
  const cityLatitude = cityLatitudeSignal.value;

  return (
    <div>
      <h2>Map: {city}</h2>

      <div
        style={{
          padding: "20px",
          backgroundColor: "#f8f9fa",
          borderRadius: "8px",
          border: "2px solid #007bff",
          marginBottom: "20px",
        }}
      >
        <h3 style={{ color: "#007bff", marginTop: 0 }}>📍 {city}</h3>
        <p>
          <strong>Longitude:</strong> {cityLongitude} |{" "}
          <strong>Latitude:</strong> {cityLatitude}
        </p>
      </div>

      <div
        style={{
          padding: "20px",
          backgroundColor: "#e9ecef",
          borderRadius: "8px",
          marginBottom: "20px",
        }}
      >
        <h4>Adjust Coordinates</h4>
        <Paragraph
          style={{ fontSize: "14px", color: "#666", marginBottom: "15px" }}
        >
          Update the coordinates below. Changes will be reflected in the URL.
        </Paragraph>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "15px",
          }}
        >
          <div>
            <label
              htmlFor="longitude"
              style={{
                display: "block",
                marginBottom: "5px",
                fontWeight: "bold",
              }}
            >
              Longitude:
            </label>
            <Input
              id="longitude"
              type="number"
              step="0.0001"
              value={lon}
              action={(value) => {
                longitudeSignal.value = value;
              }}
            />
          </div>

          <div>
            <label
              htmlFor="latitude"
              style={{
                display: "block",
                marginBottom: "5px",
                fontWeight: "bold",
              }}
            >
              Latitude:
            </label>
            <Input
              id="latitude"
              type="number"
              step="0.0001"
              value={lat}
              action={(value) => {
                latitudeSignal.value = value;
              }}
            />
          </div>
        </div>
      </div>

      <div
        style={{
          padding: "15px",
          backgroundColor: "#d1ecf1",
          border: "1px solid #bee5eb",
          borderRadius: "4px",
          marginBottom: "20px",
        }}
      >
        <h4 style={{ marginTop: 0, color: "#0c5460" }}>🗺️ Fake Map View</h4>
        <Paragraph style={{ margin: "5px 0", color: "#0c5460" }}>
          This is where a real map would be displayed showing {city} at
          coordinates ({lon}, {lat}).
        </Paragraph>
      </div>

      <div>
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
