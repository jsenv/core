import { useLayoutEffect } from "react";
import appStyleSheet from "./app.css" with { type: "css" };
import { Counter } from "./counter.jsx";

const reactLogoUrl = import.meta.resolve("../react_logo.svg");

export const App = () => {
  useLayoutEffect(() => {
    document.adoptedStyleSheets = [
      ...document.adoptedStyleSheets,
      appStyleSheet,
    ];
    return () => {
      document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
        (s) => s !== appStyleSheet,
      );
    };
  }, []);

  return (
    <div className="app">
      <header className="app_header">
        <img src={reactLogoUrl} className="app_logo" alt="logo" />
        <p>Hello jsenv + React!</p>
        <p>
          <Counter />
        </p>
        <p>
          Edit{" "}
          <a
            className="app_link"
            onClick={(e) => {
              e.preventDefault();
              window.fetch("/.internal/open_file/app/app.jsx");
            }}
          >
            app.jsx
          </a>{" "}
          and save to test HMR updates.
        </p>
        <p>
          <a
            className="app_link"
            href="https://github.com/jsenv/core"
            target="_blank"
            rel="noopener noreferrer"
          >
            Jsenv documentation
          </a>
        </p>
      </header>
    </div>
  );
};
