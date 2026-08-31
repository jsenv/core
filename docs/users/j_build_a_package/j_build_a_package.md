<!-- TITLE: J) Build a package -->

<!-- PLACEHOLDER_START:NAV_PREV_NEXT -->

<table>
  <tr>
    <td width="2000px" align="left" nowrap>
      <a href="../i_test_in_node/i_test_in_node.md">&lt; I) Test in Node.js</a>
    </td>
    <td width="2000px" align="right" nowrap>
      J) Build a package
    </td>
  </tr>
</table>

<!-- PLACEHOLDER_END -->

This page explains how to use jsenv to build **packages** (libraries, utilities, etc.) rather than complete applications. Unlike building web applications covered in [C) Build](../c_build/c_build.md), package builds are designed to create reusable modules that can be consumed by other projects.

## Package Mode

When building packages, jsenv provides a special `mode: "package"` configuration that automatically sets appropriate defaults for package builds:

- **No minification** - Keeps code readable for debugging and inspection
- **No versioning** - Packages don't need cache-busting URLs
- **Preserves comments** - Maintains JSDoc and other important comments
- **Relative base URLs** - Uses `"./"` instead of `"/"` for better portability
- **Sourcemap files** - Writes sourcemaps as separate files (`sourcemaps: "file"`)

## Package Build Types

When building a package, you need to consider your target runtime environment:

1. **Node.js packages** - For server-side, CLI tools, build scripts
2. **Browser packages** - For client-side libraries, web components
3. **Universal packages** - For libraries that work in both environments

## Common Package Build Configuration

These settings apply to all package types:

### Dependency Management

When building packages, you often want to exclude certain dependencies from the bundle:

```js
// build.mjs
import { build } from "@jsenv/core";

await build({
  sourceDirectoryUrl: import.meta.resolve("../"),
  buildDirectoryUrl: import.meta.resolve("../dist/"),
  entryPoints: {
    "./index.js": {
      buildRelativeUrl: "./my-package.js",
      mode: "package",
      // Exclude all node_modules
      ignore: {
        "file://**/node_modules/": true,
      },
    },
  },
});
```

#### Selective Dependency Exclusion

For more granular control, exclude specific dependencies:

```js
// Exclude only React (useful for peer dependencies)
ignore: {
  "file://**/node_modules/react/": true,
  "file://**/node_modules/react-dom/": true,
},
```

```js
// Exclude multiple specific packages
ignore: {
  "file://**/node_modules/lodash/": true,
  "file://**/node_modules/moment/": true,
  "file://**/node_modules/@babel/": true, // Exclude all @babel packages
},
```

This is particularly useful when:

- Building packages with peer dependencies
- Creating plugins that expect certain libraries to be provided by the consumer
- Building packages that should not bundle heavy dependencies

## Building for Node.js

Building packages for Node.js reduces the number of files, which improves performance. Fewer files means faster startup times and reduced I/O overhead. For example, @jsenv/core itself uses this approach, transforming thousands of source files into a few dozen optimized files with intelligent code splitting.

### Basic Node.js Package Build

```js
// build.mjs
import { build } from "@jsenv/core";

await build({
  sourceDirectoryUrl: import.meta.resolve("../"),
  buildDirectoryUrl: import.meta.resolve("../dist/"),
  entryPoints: {
    "./src/index.js": {
      buildRelativeUrl: "./index.js",
      mode: "package",
      runtimeCompat: {
        node: "18.0.0", // Target minimum Node.js version
      },
      ignore: {
        "file://**/node_modules/": true, // Exclude dependencies
      },
    },
  },
});
```

## Building for Browser

A package's target is not a floor imposed on the apps that consume it. Whatever
it is built with, the consuming app reads the published files and lowers them to
the target IT declares — so a package built for recent browsers is still usable
by an app supporting older ones, and pays nothing for browsers it never meets.
Aim it at what the package's own code needs, not at the widest audience you can
imagine. See [browser support](../c_build/c_build.md#21-browser-support).

The one exception is css a build cannot parse, which ships verbatim and can be
lowered by nobody — see `import.meta.css` in the package you are building.

### Basic Browser Package Build

```js
// build.mjs
import { build } from "@jsenv/core";

await build({
  sourceDirectoryUrl: import.meta.resolve("../"),
  buildDirectoryUrl: import.meta.resolve("../dist/"),
  entryPoints: {
    "./src/index.js": {
      buildRelativeUrl: "./browser.js",
      mode: "package",
      runtimeCompat: {
        chrome: "125",
        edge: "125",
        firefox: "126",
        safari: "17.5",
      },
      ignore: {
        "file://**/node_modules/": true,
      },
    },
  },
});
```

## Building Universal Packages

Universal packages work in both Node.js and browser environments. This requires careful consideration of:

- Runtime-specific APIs
- Module formats
- Dependency management

### Dual Build Strategy

Create separate builds for each environment. A given entry point can only appear once per `entryPoints` object, so building the same file for two environments means calling `build` twice, each with its own build directory:

```js
// build.mjs
import { build } from "@jsenv/core";

// Node.js build
await build({
  sourceDirectoryUrl: import.meta.resolve("../"),
  buildDirectoryUrl: import.meta.resolve("../dist/node/"),
  entryPoints: {
    "./src/index.js": {
      buildRelativeUrl: "./index.js",
      mode: "package",
      runtimeCompat: {
        node: "18.0.0",
      },
      ignore: {
        "file://**/node_modules/": true,
      },
    },
  },
});

// Browser build
await build({
  sourceDirectoryUrl: import.meta.resolve("../"),
  buildDirectoryUrl: import.meta.resolve("../dist/browser/"),
  entryPoints: {
    "./src/index.js": {
      buildRelativeUrl: "./index.js",
      mode: "package",
      runtimeCompat: {
        chrome: "125",
        edge: "125",
        firefox: "126",
        safari: "17.5",
      },
      ignore: {
        "file://**/node_modules/": true,
      },
    },
  },
});
```

### Package.json Configuration

Configure your package.json to support both environments:

```json
{
  "name": "my-universal-package",
  "type": "module",
  "exports": {
    ".": {
      "node": "./dist/node/index.js",
      "browser": "./dist/browser/index.js",
      "default": "./dist/browser/index.js"
    }
  },
  "main": "./dist/node/index.js",
  "browser": "./dist/browser/index.js"
}
```

## Advanced Package Configuration

### Conditional Builds

Build different versions based on conditions:

```js
const isProduction = process.env.NODE_ENV === "production";

entryPoints: {
  "./src/index.js": {
    buildRelativeUrl: "./index.js",
    mode: "package", // Sets package-appropriate defaults
    // Override defaults when needed
    minification: isProduction,
    sourcemaps: isProduction ? "none" : "file",
  },
},
```

<!-- PLACEHOLDER_START:NAV_PREV_NEXT -->

<table>
  <tr>
    <td width="2000px" align="left" nowrap>
      <a href="../i_test_in_node/i_test_in_node.md">&lt; I) Test in Node.js</a>
    </td>
    <td width="2000px" align="right" nowrap>
      J) Build a package
    </td>
  </tr>
</table>

<!-- PLACEHOLDER_END -->
