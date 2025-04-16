# Jsenv Filesystem [![npm package](https://img.shields.io/npm/v/@jsenv/filesystem.svg?logo=npm&label=package)](https://www.npmjs.com/package/@jsenv/filesystem)

A modern, Promise-based collection of utilities to interact with the filesystem in Node.js.

🔍 Pattern-based file operations  
👀 Efficient file/directory watching  
🔄 Lifecycle hooks for file changes  
🛠️ URL-based path handling

## Installation

```console
npm install @jsenv/filesystem
```

## Table of Contents

- [Jsenv Filesystem ](#jsenv-filesystem-)
  - [Installation](#installation)
  - [Table of Contents](#table-of-contents)
  - [Quick Start](#quick-start)
  - [Features](#features)
    - [List Files Using Pattern Matching](#list-files-using-pattern-matching)
    - [Watch a Specific File Changes](#watch-a-specific-file-changes)
    - [Watch Many Files Changes](#watch-many-files-changes)
    - [Other Common Operations](#other-common-operations)
  - [API](#api)

## Quick Start

```js
import { listFilesMatching, writeFile, moveFile } from "@jsenv/filesystem";

// Find JavaScript files (excluding tests)
const jsFiles = await listFilesMatching({
  directoryUrl: new URL("./src/", import.meta.url),
  patterns: {
    "./**/*.js": true,
    "./**/*.test.js": false,
  },
});

// Create a new file
await writeFile(new URL("./output.txt", import.meta.url), "Hello world");

// Move a file
await moveFile({
  source: new URL("./output.txt", import.meta.url),
  destination: new URL("./moved.txt", import.meta.url),
});
```

## Features

### List Files Using Pattern Matching

Find files with powerful pattern matching that supports inclusion and exclusion patterns:

```js
import { listFilesMatching } from "@jsenv/filesystem";

const jsFiles = await listFilesMatching({
  directoryUrl: new URL("./", import.meta.url),
  patterns: {
    "./**/*.js": true, // Include all JS files
    "./**/*.test.js": false, // Exclude test files
    "./node_modules/": false, // Exclude node_modules directory
  },
});
```

Example output:

```console
[
  'file:///Users/dmail/docs/demo/a.js',
  'file:///Users/dmail/docs/demo/b.js'
]
```

### Watch a Specific File Changes

Monitor a single file for changes with lifecycle hooks:

```js
import { readFileSync } from "node:fs";
import { registerFileLifecycle } from "@jsenv/filesystem";

const packageJSONFileUrl = new URL("./package.json", import.meta.url);
let packageJSON = null;

// Start watching the file
const unregister = registerFileLifecycle(packageJSONFileUrl, {
  added: () => {
    packageJSON = JSON.parse(String(readFileSync(packageJSONFileUrl)));
    console.log("Package.json was added");
  },
  updated: () => {
    packageJSON = JSON.parse(String(readFileSync(packageJSONFileUrl)));
    console.log("Package.json was updated");
  },
  removed: () => {
    packageJSON = null;
    console.log("Package.json was removed");
  },
  notifyExistent: true, // Trigger 'added' callback if file exists when watching starts
});

// Later, when done watching:
unregister(); // Stop watching the file changes
```

### Watch Many Files Changes

Monitor an entire directory with pattern filtering:

```js
import { registerDirectoryLifecycle } from "@jsenv/filesystem";

const directoryContentDescription = {};

// Start watching the directory
const unregister = registerDirectoryLifecycle("file:///directory/", {
  watchPatterns: {
    "./**/*": true, // Watch all files
    "./node_modules/": false, // Except files in node_modules
  },
  added: ({ relativeUrl, type }) => {
    directoryContentDescription[relativeUrl] = type;
    console.log(`Added: ${relativeUrl} (${type})`);
  },
  updated: ({ relativeUrl, type }) => {
    console.log(`Updated: ${relativeUrl} (${type})`);
  },
  removed: ({ relativeUrl }) => {
    delete directoryContentDescription[relativeUrl];
    console.log(`Removed: ${relativeUrl}`);
  },
});

// Later, when done watching:
unregister(); // Stop watching the directory changes
```

### Other Common Operations

```js
import {
  ensureEmptyDirectory,
  writeFile,
  readFile,
  copyFile,
  moveFile,
  removeFile,
} from "@jsenv/filesystem";

// Create or empty a directory
await ensureEmptyDirectory(new URL("./dist/", import.meta.url));

// Write a file (creates directories if needed)
await writeFile(
  new URL("./logs/debug.log", import.meta.url),
  "Debug information",
);

// Read a file (returns a string by default)
const content = await readFile(new URL("./config.json", import.meta.url));

// Copy a file
await copyFile({
  source: new URL("./template.html", import.meta.url),
  destination: new URL("./output/index.html", import.meta.url),
});

// Move a file
await moveFile({
  source: new URL("./temp.txt", import.meta.url),
  destination: new URL("./final/document.txt", import.meta.url),
});

// Remove a file
await removeFile(new URL("./obsolete.txt", import.meta.url));
```

## API

For a complete list of all available functions and their parameters, see the [API documentation](./docs/API.md).
