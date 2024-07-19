import mainStyleSheet from "./main.css" with { type: "css" };
import { initCounter } from "./app/counter.js";

document.adoptedStyleSheets = [...document.adoptedStyleSheets, mainStyleSheet];

const jsenvLogoUrl = new URL("/jsenv_logo.svg", import.meta.url);

document.querySelector("#root").innerHTML = `<h1>Hello world!</h1>
<img class="logo" src=${jsenvLogoUrl} alt="logo" />
<p>
  <button id="counter_button">Click me!</button>
  <p>
    Number of clicks: <span id="counter_output"></span>
  </p>
</p>
<p>
  Edit <a href="javascript:window.fetch('/__open_in_editor__/jsenv_logo.svg')">jsenv_logo.svg</a> and save to test HMR updates.
</p>
<a href="https://github.com/jsenv/core" target="_blank">Documentation</a>`;

initCounter();

if (import.meta.hot) {
  import.meta.hot.accept();
  import.meta.hot.dispose(() => {
    document.querySelector("#root").innerHTML = "";
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
      (s) => s !== mainStyleSheet,
    );
  });
}
