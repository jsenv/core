# custom-elements-redefine [![npm package](https://img.shields.io/npm/v/@jsenv/custom-elements-redefine.svg?logo=npm&label=package)](https://www.npmjs.com/package/@jsenv/custom-elements-redefine)

Override the `customElements.define` API to allow hot reloading of web components.

🔄 Enables redefining custom elements  
🔥 Perfect for hot module replacement workflows  
🛠️ Fixes common issues with component development  
⚡ Seamless integration with development servers

## Problem

By default, browsers do not allow redefining a custom element once it's been registered:

```console
Uncaught DOMException: Failed to execute 'define' on 'CustomElementRegistry':
the name "my-element" has already been used with this registry
```

This restriction breaks hot module replacement workflows where component code is reloaded without refreshing the page.

## Solution

This package provides a patch that allows custom elements to be redefined without errors, enabling smooth development workflows with tools that support hot reloading.

## Installation

```console
npm install @jsenv/custom-elements-redefine
```

## Usage

```js
import { allowCustomElementsRedefine } from "@jsenv/custom-elements-redefine";

// Apply the patch before defining any custom elements
allowCustomElementsRedefine();

// First definition
customElements.define(
  "my-element",
  class extends HTMLElement {
    version = 1;
  },
);
document.createElement("my-element").version; // 1

// Later (e.g., after hot reload), redefine with a new implementation
customElements.define(
  "my-element",
  class extends HTMLElement {
    version = 2;
  },
);
document.createElement("my-element").version; // 2
```

## Issues

This package fixes issues like [lit/lit#1844](https://github.com/lit/lit/issues/1844) where components can't be hot reloaded properly.

## License

MIT
