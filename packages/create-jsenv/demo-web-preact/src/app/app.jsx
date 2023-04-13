import { useState, useLayoutEffect } from "preact/hooks";

import appStyleSheet from "./app.css" assert { type: "css" };

const preactLogoUrl = new URL("../preact_logo.svg", import.meta.url);

export const App = () => {
  const [count, setCount] = useState(0);

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
        <img src={preactLogoUrl} className="app_logo" alt="logo" />
        <p>Hello jsenv + preact!</p>
        <p>
          <button type="button" onClick={() => setCount((count) => count + 1)}>
            Click me
          </button>
          <br />
          <span>number of click: {count}</span>
        </p>
        <p>
          Edit <code>app.jsx</code> and save to test HMR updates.
        </p>
        <p>
          <a
            className="app_link"
            href="https://github.com/jsenv/jsenv-core"
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
