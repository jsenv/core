# custom-elements-redefine [![npm package](https://img.shields.io/npm/v/@jsenv/custom-elements-redefine.svg?logo=npm&label=package)](https://www.npmjs.com/package/@jsenv/custom-elements-redefine)

This package overrides [customElements.define](https://developer.mozilla.org/en-US/docs/Web/API/CustomElementRegistry/define) to allow re-defining an element constructor.

It prevents the following error to happen:

```console
Uncaught DOMException: Failed to execute 'define' on 'CustomElementRegistry': the name "my-test" has already been used with this registry
```

The goal is to make code using custom elements compatible with hot reloading: ability to reload js instead of having to reload the whole page.

It fixes issues like https://github.com/lit/lit/issues/1844
This package is a modified version of https://github.com/vegarringdal/custom-elements-hmr-polyfill

# Usage

```js
import { allowCustomElementsRedefine } from "@jsenv/custom-elements-redefine";

allowCustomElementsRedefine();

customElements.define(
  "my-element",
  class extends HTMLElement {
    version = 1;
  },
);
document.createElement("my-element").version; // 1
customElements.define(
  "my-element",
  class extends HTMLElement {
    version = 2;
  },
);
document.createElement("my-element").version; // 2
```
