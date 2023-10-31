import AppCustomElementStyleSheet from "./app_custom_element.css" assert { type: "css" };

const jsenvLogoUrl = new URL("/jsenv_logo.svg", import.meta.url);

class AppCustomElement extends HTMLElement {
  constructor() {
    super();
    const shadow = this.attachShadow({ mode: "open" });
    shadow.adoptedStyleSheets = [
      ...shadow.adoptedStyleSheets,
      AppCustomElementStyleSheet,
    ];
    let clicks = 0;
    shadow.innerHTML = `
<h1>Hello world!</h1>
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
    const button = shadow.querySelector("#click_button");
    const clickOutput = shadow.querySelector("#click_output");
    button.onclick = () => {
      clicks++;
      clickOutput.innerHTML = clicks;
    };
  }
}

customElements.define("my-app", AppCustomElement);
