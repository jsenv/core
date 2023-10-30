import AppCustomElementStyleSheet from "./app_custom_element.css" assert { type: "css" };

export class AppCustomElement extends HTMLElement {
  constructor({ logoUrl }) {
    super();
    const shadow = this.attachShadow({ mode: "open" });
    shadow.adoptedStyleSheets = [
      ...shadow.adoptedStyleSheets,
      AppCustomElementStyleSheet,
    ];
    shadow.innerHTML = `
<h1>Hello world!</h1>
<img class="logo" src=${logoUrl} alt="logo" />
<p>
  Edit <a href="javascript:window.fetch('/__open_in_editor__/jsenv_logo.svg')">jsenv_logo.svg</a> and save to test HMR updates.
</p>
<a href="https://github.com/jsenv/core" target="_blank">Documentation</a>`;
  }
}

customElements.define("my-app", AppCustomElement);
