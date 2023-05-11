# Jsenv filesystem [![npm package](https://img.shields.io/npm/v/@jsenv/filesystem.svg?logo=npm&label=package)](https://www.npmjs.com/package/@jsenv/filesystem)

Collection of functions to interact with filesystem in Node.js

## List files using pattern matching

```js
import { listFilesMatching } from "@jsenv/filesystem";

const jsFiles = await listFilesMatching({
  directoryUrl: new URL("./", import.meta.url),
  patterns: {
    "./**/*.js": true,
    "./**/*.test.js": false,
  },
});
```

```console
[
  'file:///Users/dmail/docs/demo/a.js',
  'file:///Users/dmail/docs/demo/b.js'
]
```

## Watch a specific file changes

```js
import { readFileSync } from "node:fs";
import { registerFileLifecycle } from "@jsenv/filesystem";

const packageJSONFileUrl = new URL("./package.json", import.meta.url);
let packageJSON = null;
const unregister = registerFileLifecycle(packageJSONFileUrl, {
  added: () => {
    packageJSON = JSON.parse(String(readFileSync(packageJSONFileUrl)));
  },
  updated: () => {
    packageJSON = JSON.parse(String(readFileSync(packageJSONFileUrl)));
  },
  removed: () => {
    packageJSON = null;
  },
  notifyExistent: true,
});
unregister(); // stop watching the file changes
```

## Watch many files changes

```js
import { registerDirectoryLifecycle } from "@jsenv/filesystem";

const directoryContentDescription = {};
const unregister = registerDirectoryLifecycle("file:///directory/", {
  watchPatterns: {
    "./**/*": true,
    "./node_modules/": false,
  },
  added: ({ relativeUrl, type }) => {
    directoryContentDescription[relativeUrl] = type;
  },
  removed: ({ relativeUrl }) => {
    delete directoryContentDescription[relativeUrl];
  },
});
unregister(); // stop watching the directory changes
```

# API

[docs/API.md](./docs/API.md)

# Installation

```console
npm install @jsenv/filesystem
```
