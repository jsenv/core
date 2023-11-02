import React from "react";
import ReactDOM from "react-dom/client";

import { App } from "./app/app.jsx";

ReactDOM.createRoot(document.querySelector("#root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

if (import.meta.hot) {
  import.meta.hot.accept();
}
