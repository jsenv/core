import { render } from "preact";

import { Route, Routes, setupRoutes, TabList } from "@jsenv/navi";

// Setup routes with search params handling
const { HOME_ROUTE, COLOR_ROUTE, COLOR_LIGHT_ROUTE, COLOR_DARK_ROUTE } =
  setupRoutes({
    HOME_ROUTE: "/",
    COLOR_ROUTE: "/colors",
    COLOR_LIGHT_ROUTE: "/colors/light",
    COLOR_DARK_ROUTE: "/colors/dark",
  });

// Color picker component
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

// Home page component
const HomePage = () => {
  return (
    <div>
      <h2>Home Page</h2>
      <p>This is the home page with no search params.</p>
    </div>
  );
};

// Colors page component
const ColorsPage = ({ color = "blue" }) => {
  const handleColorChange = (newColor) => {
    // Update the URL with new color param
    COLOR_ROUTE.replaceParams({ color: newColor });
  };

  return (
    <div>
      <h2>Colors Page</h2>
      <p>
        Current color: <strong style={{ color }}>{color}</strong>
      </p>

      <ColorPicker currentColor={color} onColorChange={handleColorChange} />

      <h3>Sub-pages</h3>
      <TabList>
        <TabList.Tab
          route={COLOR_LIGHT_ROUTE}
          routeParams={{ color, theme: "pastel" }}
        >
          Light theme
        </TabList.Tab>
        <TabList.Tab
          route={COLOR_DARK_ROUTE}
          routeParams={{ color, mode: "intense" }}
        >
          Dark mode
        </TabList.Tab>
      </TabList>

      <div style={{ marginTop: "20px" }}>
        <TabList>
          <TabList.Tab route={HOME_ROUTE}>← Home</TabList.Tab>
        </TabList>
      </div>
    </div>
  );
};

// Light theme subpage
const LightThemePage = ({ color = "blue", theme = "default" }) => {
  const handleThemeChange = (newTheme) => {
    COLOR_LIGHT_ROUTE.replaceParams({ color, theme: newTheme });
  };

  const handleColorChange = (newColor) => {
    COLOR_LIGHT_ROUTE.replaceParams({ color: newColor, theme });
  };

  return (
    <div
      style={{
        backgroundColor: `light${color}`,
        padding: "20px",
        minHeight: "200px",
      }}
    >
      <h2>Light Theme Page</h2>
      <p>
        Color: <strong style={{ color }}>{color}</strong>
      </p>
      <p>
        Theme: <strong>{theme}</strong>
      </p>

      <ColorPicker currentColor={color} onColorChange={handleColorChange} />

      <div style={{ margin: "10px 0" }}>
        <label>Theme: </label>
        {["pastel", "bright", "soft"].map((t) => (
          <button
            key={t}
            style={{
              margin: "0 5px",
              padding: "5px 10px",
              backgroundColor: theme === t ? "#333" : "white",
              color: theme === t ? "white" : "black",
              border: "1px solid #ccc",
            }}
            onClick={() => handleThemeChange(t)}
          >
            {t}
          </button>
        ))}
      </div>

      <div style={{ marginTop: "20px" }}>
        <TabList>
          <TabList.Tab route={COLOR_ROUTE} routeParams={{ color }}>
            ← Colors
          </TabList.Tab>
          <TabList.Tab route={HOME_ROUTE}>Home</TabList.Tab>
        </TabList>
      </div>
    </div>
  );
};

// Dark mode subpage
const DarkModePage = ({ color = "blue", mode = "standard" }) => {
  const handleModeChange = (newMode) => {
    COLOR_DARK_ROUTE.replaceParams({ color, mode: newMode });
  };

  const handleColorChange = (newColor) => {
    COLOR_DARK_ROUTE.replaceParams({ color: newColor, mode });
  };

  return (
    <div
      style={{
        backgroundColor: "#222",
        color: "white",
        padding: "20px",
        minHeight: "200px",
        border: `3px solid ${color}`,
      }}
    >
      <h2>Dark Mode Page</h2>
      <p>
        Color: <strong style={{ color }}>{color}</strong>
      </p>
      <p>
        Mode: <strong>{mode}</strong>
      </p>

      <ColorPicker currentColor={color} onColorChange={handleColorChange} />

      <div style={{ margin: "10px 0" }}>
        <label>Mode: </label>
        {["standard", "intense", "minimal"].map((m) => (
          <button
            key={m}
            style={{
              margin: "0 5px",
              padding: "5px 10px",
              backgroundColor: mode === m ? color : "#444",
              color: "white",
              border: "1px solid #666",
            }}
            onClick={() => handleModeChange(m)}
          >
            {m}
          </button>
        ))}
      </div>

      <div style={{ marginTop: "20px" }}>
        <TabList>
          <TabList.Tab route={COLOR_ROUTE} routeParams={{ color }}>
            ← Colors
          </TabList.Tab>
          <TabList.Tab route={HOME_ROUTE}>Home</TabList.Tab>
        </TabList>
      </div>
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
        <li>
          ☀️ <strong>Light subpage:</strong> Uses ?color and ?theme params
        </li>
        <li>
          🌙 <strong>Dark subpage:</strong> Uses ?color and ?mode params
        </li>
      </ul>

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
          <Route route={COLOR_LIGHT_ROUTE} element={<LightThemePage />} />
          <Route route={COLOR_DARK_ROUTE} element={<DarkModePage />} />
        </Routes>
      </div>
    </div>
  );
};

render(<App />, document.getElementById("app"));
