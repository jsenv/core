import { render } from "preact";

import {
  Route,
  Routes,
  setupRoutes,
  TabList,
  useRouteStatus,
  useUrlSearchParam,
} from "@jsenv/navi";

// Setup routes with search params handling
const { HOME_ROUTE, COLOR_ROUTE } = setupRoutes({
  HOME_ROUTE: "/",
  COLOR_ROUTE: "/colors",
});

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
      <TabList>
        <TabList.Tab route={HOME_ROUTE}>Home</TabList.Tab>
        <TabList.Tab route={COLOR_ROUTE}>Colors (default)</TabList.Tab>
        <TabList.Tab route={COLOR_ROUTE} routeParams={{ color: "red" }}>
          Colors (red)
        </TabList.Tab>
        <TabList.Tab route={COLOR_ROUTE} routeParams={{ color: "green" }}>
          Colors (green)
        </TabList.Tab>
        <TabList.Tab route={COLOR_ROUTE} routeParams={{ color: "purple" }}>
          Colors (purple)
        </TabList.Tab>
      </TabList>

      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: "8px",
          padding: "20px",
          marginTop: "20px",
        }}
      >
        <Routes>
          <Route route={HOME_ROUTE} element={<HomePage />} />
          <Route route={COLOR_ROUTE} element={<ColorsPage />} />
        </Routes>
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
