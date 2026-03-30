import { render } from "preact";

import {
  Link,
  Nav,
  route,
  Route,
  setupRoutes,
  useRouteStatus,
  useUrlSearchParam,
} from "@jsenv/navi";

const HOME_ROUTE = route("");
const COLOR_ROUTE = route("/colors");
setupRoutes([HOME_ROUTE, COLOR_ROUTE]);

const App = () => {
  const { params } = useRouteStatus(COLOR_ROUTE);

  return (
    <div
      style={{
        fontFamily: "Arial, sans-serif",
        maxWidth: "800px",
        margin: "0 auto",
        padding: "20px",
      }}
    >
      <h1>Search Parameters Demo</h1>
      <p>
        This demo shows how search parameters are handled during navigation:
      </p>
      <ul>
        <li>
          🏠 <strong>Home:</strong> No search params
        </li>
        <li>
          🎨 <strong>Colors page:</strong> Uses ?color param
        </li>
      </ul>

      <div>
        Debug COLOR_ROUTE params:
        <pre>{JSON.stringify(params, null, 2)}</pre>
      </div>

      <h3>Navigation</h3>
      <Nav>
        <Link route={HOME_ROUTE} appearance="tab" padding="s" currentIndicator>
          Home
        </Link>
        <Link
          route={COLOR_ROUTE}
          routeParams={{ color: undefined }}
          appearance="tab"
          padding="s"
          currentIndicator
        >
          Colors (default)
        </Link>
        <Link
          route={COLOR_ROUTE}
          routeParams={{ color: "red" }}
          appearance="tab"
          padding="s"
          currentIndicator
        >
          Colors (red)
        </Link>
        <Link
          route={COLOR_ROUTE}
          routeParams={{ color: "green" }}
          appearance="tab"
          padding="s"
          currentIndicator
        >
          Colors (green)
        </Link>
        <Link
          route={COLOR_ROUTE}
          routeParams={{ color: "purple" }}
          appearance="tab"
          padding="s"
          currentIndicator
        >
          Colors (purple)
        </Link>
      </Nav>

      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: "8px",
          padding: "20px",
          marginTop: "20px",
        }}
      >
        <Route>
          <Route route={HOME_ROUTE} element={<HomePage />} />
          <Route route={COLOR_ROUTE} element={<ColorsPage />} />
        </Route>
      </div>
    </div>
  );
};
const HomePage = () => {
  return (
    <div>
      <h2>Home Page</h2>
      <p>This is the home page with no search params.</p>
    </div>
  );
};
const ColorsPage = () => {
  const [color, setColor] = useUrlSearchParam("color");

  const handleColorChange = (newColor) => {
    setColor(newColor);
  };

  return (
    <div>
      <h2>Colors Page</h2>
      <p>
        Current color: <strong style={{ color }}>{color}</strong>
      </p>

      <ColorPicker currentColor={color} onColorChange={handleColorChange} />
    </div>
  );
};
const ColorPicker = ({ currentColor, onColorChange }) => {
  const colors = ["red", "green", "blue", "purple", "orange"];

  return (
    <div style={{ margin: "10px 0" }}>
      <label>Choose color: </label>
      {colors.map((color) => (
        <button
          key={color}
          style={{
            margin: "0 5px",
            padding: "5px 10px",
            backgroundColor: currentColor === color ? color : "lightgray",
            color: currentColor === color ? "white" : "black",
            border: "1px solid #ccc",
            borderRadius: "3px",
          }}
          onClick={() => onColorChange(color)}
        >
          {color}
        </button>
      ))}
    </div>
  );
};

render(<App />, document.getElementById("app"));
