import mainStyleSheet from "./main.css" assert { type: "css" };

document.adoptedStyleSheets = [...document.adoptedStyleSheets, mainStyleSheet];

const jsenvLogoUrl = new URL("/jsenv_logo.svg", import.meta.url);
let clicks = 0;
document.querySelector("#root").innerHTML = `<h1>Hello world!</h1>
<img class="logo" src=${jsenvLogoUrl} alt="logo" />
<p>
  <button id="click_button">Click me!</button>
  <p>
    Number of clicks: <span id="click_output">${clicks}</span>
  </p>
</p>
<p>
  Edit <a href="javascript:window.fetch('/__open_in_editor__/jsenv_logo.svg')">jsenv_logo.svg</a> and save to test HMR updates.
</p>
<a href="https://github.com/jsenv/core" target="_blank">Documentation</a>`;

const button = document.querySelector("#click_button");
const clickOutput = document.querySelector("#click_output");
button.onclick = () => {
  clicks++;
  clickOutput.innerHTML = clicks;
};

if (import.meta.hot) {
  import.meta.hot.accept();
  import.meta.hot.dispose(() => {
    document.querySelector("#root").innerHTML = "";
    document.adoptedStyleSheets = document.adoptedStyleSheets.filter(
      (s) => s !== mainStyleSheet,
    );
  });
}
