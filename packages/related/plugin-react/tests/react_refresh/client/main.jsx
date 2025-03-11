import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./app.jsx";

ReactDOM.createRoot(document.getElementById("app")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

window.resolveReadyPromise();

if (import.meta.hot) {
  import.meta.hot.accept();
}
