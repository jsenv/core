# @jsenv/core

[![npm package](https://img.shields.io/npm/v/@jsenv/core.svg?logo=npm&label=package)](https://www.npmjs.com/package/@jsenv/core)

## Overview

Jsenv is a suite of tools for JavaScript projects that prioritizes standards and simplicity, making it ideal for both beginners and those who need straightforward tools.

## Installation

```console
npm install --save-dev @jsenv/core
```

> **Compatibility**: Tested on Mac, Windows, and Linux with Node.js 20. Other environments are not officially tested.

## Documentation

For comprehensive documentation, see the full [user documentation](https://github.com/jsenv/core/blob/main/docs/users/users.md).

## Basic Usage

Start a development server:

```js
import { startDevServer } from "@jsenv/core";

await startDevServer({
  sourceDirectoryUrl: import.meta.resolve("./"),
});
```

## Core Features

`@jsenv/core` provides four main tools:

1. **Dev Server**: Serves source files with live reloading to facilitate development
2. **Build**: Optimizes source files into a specified directory for production
3. **Build Server**: Serves the built files, allowing for testing and verifying the production build
4. **Test Runner**: Runs test files concurrently to ensure code reliability

## Key Advantages

- **Standards-first approach**: Built on web standards rather than custom abstractions
- **Robust versioning**: Avoids cascading hash changes during builds
- **Broad browser compatibility**: Works with modern and older browsers
- **Isolated testing**: Prevents cross-test contamination
- **Simple API**: Designed for clarity and ease of use

## Quick Start

The easiest way to try jsenv is with the CLI:

```console
npx @jsenv/cli
```

The CLI provides templates for web applications, React projects, and Node.js packages to get you started quickly.

Read more in [@jsenv/cli](https://github.com/jsenv/core/tree/main/packages/related/cli#jsenvcli).
