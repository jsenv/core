# Dynamic import worker [![npm package](https://img.shields.io/npm/v/@jsenv/dynamic-import-worker.svg?logo=npm&label=package)](https://www.npmjs.com/package/@jsenv/dynamic-import-worker)

Bypass Node.js module cache on dynamic imports using worker threads.

🔄 Import modules without cache  
🧵 Uses worker threads for isolation  
📦 Extract specific exports from modules  
⚡ Perfect for testing reloaded modules

## Installation

```console
npm install @jsenv/dynamic-import-worker
```

## Problem

In Node.js, imported modules are cached by their URL. Calling `import()` on the same URL will return the cached module, even if the file has changed:

```js
// First import (reads from disk)
const module1 = await import("./module.js");

// Later, even if file changes on disk
const module2 = await import("./module.js");
// module2 === module1 (returns cached version)
```

This behavior makes it challenging to reload modules during development or testing.

## Solution

This package uses Node.js worker threads to perform imports in a separate context, allowing you to bypass the module cache and always import the latest version of a file.

## Usage Examples

### Basic Example

```js
import { importOneExportFromFile } from "@jsenv/dynamic-import-worker";

const randomNumberFileUrl = import.meta
  .resolve("./random_number.mjs#randomNumber");

const randomNumberA = await importOneExportFromFile(randomNumberFileUrl);
const randomNumberB = await importOneExportFromFile(randomNumberFileUrl);

console.log(randomNumberA); // 0.5362418125287491
console.log(randomNumberB); // 0.35129949391010595 (different value)
```

_random_number.mjs_

```js
export const randomNumber = Math.random();
```

The export name is specified in the URL fragment.

## How It Works

1. Creates a new worker thread for each import
2. Worker loads the file from disk
3. Exports are sent back to the main thread
4. Worker is terminated

This approach ensures:

- No module caching between imports
- Complete isolation of module execution
- Fresh evaluation of the module code

## Use Cases

- Testing modules during development
- Hot reloading configurations
- Dynamic content that needs fresh evaluation
- Test runners that need to reload modules

## License

[MIT](./LICENSE)
