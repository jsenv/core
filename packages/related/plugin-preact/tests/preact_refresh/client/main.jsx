import { render } from "preact";

const { App } = await import("./app.jsx");

render(<App />, document.querySelector("#app"));

if (import.meta.hot) {
  import.meta.hot.accept();
}

window.resolveReadyPromise();
