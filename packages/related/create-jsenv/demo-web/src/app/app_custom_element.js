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
    shadow.innerHTML = `
<h1>Hello world!</h1>
<img class="logo" src=${jsenvLogoUrl} alt="logo" />
<p>
  Edit <a href="javascript:window.fetch('/__open_in_editor__/jsenv_logo.svg')">jsenv_logo.svg</a> and save to test HMR updates.
</p>
<a href="https://github.com/jsenv/core" target="_blank">Documentation</a>`;
  }
}

customElements.define("my-app", AppCustomElement);
