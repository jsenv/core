import { render } from "preact";
import { useEffect, useState } from "preact/hooks";

import {
  Route,
  RouteLink,
  Routes,
  setupRoutes,
  TabList,
  useRouteStatus,
} from "@jsenv/navi";

// Setup routes for city map demo
const { HOME_ROUTE, SELECT_CITY_ROUTE, MAP_ROUTE } = setupRoutes({
  HOME_ROUTE: "/",
  SELECT_CITY_ROUTE: "/select-city",
  MAP_ROUTE: "/map/:cityName?lon=:lon&lat=:lat",
});

MAP_ROUTE.describeParam("cityName", {
  invalidEffect: "redirect",
});

MAP_ROUTE.describeParam("lon", {
  default: "",
});

MAP_ROUTE.describeParam("lat", {
  default: "",
});

// Fake coordinates for cities
const CITY_COORDINATES = {
  "Paris": { lon: 2.3522, lat: 48.8566 },
  "London": { lon: -0.1276, lat: 51.5074 },
  "Tokyo": { lon: 139.6917, lat: 35.6895 },
  "New York": { lon: -74.006, lat: 40.7128 },
  "Sydney": { lon: 151.2093, lat: -33.8688 },
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
  const cities = Object.keys(CITY_COORDINATES);

  return (
    <div>
      <h2>Select a City</h2>
      <p>Choose a city to view on the map:</p>

      <div style={{ marginTop: "15px" }}>
        {cities.map((city) => (
          <div key={city} style={{ marginBottom: "10px" }}>
            <RouteLink
              route={MAP_ROUTE}
              routeParams={{ cityName: city }}
              style={{
                padding: "8px 16px",
                backgroundColor: "#28a745",
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
    </div>
  );
};

const MapPage = () => {
  const { params } = useRouteStatus(MAP_ROUTE);
  const [coordinates, setCoordinates] = useState({ lon: "", lat: "" });
  const [isLoading, setIsLoading] = useState(false);

  // Redirect if no city is selected
  if (!params.cityName) {
    SELECT_CITY_ROUTE.navigate();
    return <div>Redirecting to city selection...</div>;
  }

  // Fake API call to get coordinates
  useEffect(() => {
    const fetchCoordinates = async () => {
      setIsLoading(true);

      // Simulate API delay
      await new Promise((resolve) => setTimeout(resolve, 500));

      const cityCoords = CITY_COORDINATES[params.cityName];
      if (cityCoords && !params.lon && !params.lat) {
        // Only set default coordinates if none are provided in URL
        setCoordinates(cityCoords);
        MAP_ROUTE.navigate({
          cityName: params.cityName,
          lon: cityCoords.lon,
          lat: cityCoords.lat,
        });
      } else if (params.lon && params.lat) {
        // Use coordinates from URL
        setCoordinates({
          lon: parseFloat(params.lon) || 0,
          lat: parseFloat(params.lat) || 0,
        });
      }

      setIsLoading(false);
    };

    fetchCoordinates();
  }, [params.cityName, params.lon, params.lat]);

  const handleCoordinateChange = (type, value) => {
    const newCoordinates = { ...coordinates, [type]: parseFloat(value) || 0 };
    setCoordinates(newCoordinates);

    // Update URL parameters
    MAP_ROUTE.navigate({
      cityName: params.cityName,
      lon: newCoordinates.lon,
      lat: newCoordinates.lat,
    });
  };

  if (isLoading) {
    return (
      <div>
        <h2>Loading Map...</h2>
        <p>Fetching coordinates for {params.cityName}...</p>
      </div>
    );
  }

  return (
    <div>
      <h2>Map: {params.cityName}</h2>

      <div
        style={{
          padding: "20px",
          backgroundColor: "#f8f9fa",
          borderRadius: "8px",
          border: "2px solid #007bff",
          marginBottom: "20px",
        }}
      >
        <h3 style={{ color: "#007bff", marginTop: 0 }}>📍 {params.cityName}</h3>
        <p>
          <strong>Longitude:</strong> {coordinates.lon} |{" "}
          <strong>Latitude:</strong> {coordinates.lat}
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
        <p style={{ fontSize: "14px", color: "#666", marginBottom: "15px" }}>
          Update the coordinates below. Changes will be reflected in the URL.
        </p>

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
            <input
              id="longitude"
              type="number"
              step="0.0001"
              value={coordinates.lon}
              onChange={(e) => handleCoordinateChange("lon", e.target.value)}
              style={{
                width: "100%",
                padding: "8px",
                border: "1px solid #ccc",
                borderRadius: "4px",
                fontSize: "14px",
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
            <input
              id="latitude"
              type="number"
              step="0.0001"
              value={coordinates.lat}
              onChange={(e) => handleCoordinateChange("lat", e.target.value)}
              style={{
                width: "100%",
                padding: "8px",
                border: "1px solid #ccc",
                borderRadius: "4px",
                fontSize: "14px",
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
        <p style={{ margin: "5px 0", color: "#0c5460" }}>
          This is where a real map would be displayed showing {params.cityName}{" "}
          at coordinates ({coordinates.lon}, {coordinates.lat}).
        </p>
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
