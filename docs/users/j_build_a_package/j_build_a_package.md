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

Node.js packages are typically used for:
- Server-side libraries
- CLI tools
- Build scripts and automation
- Backend utilities

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
      runtimeCompat: {
        node: "18.0.0", // Target minimum Node.js version
      },
      format: "esm", // or "commonjs" for legacy compatibility
      minification: true,
      bundling: true, // Bundle dependencies into single file
      ignore: {
        "file://**/node_modules/": true, // Exclude dependencies
      },
    },
  },
});
```

### Multiple Entry Points for Node.js

```js
entryPoints: {
  "./src/index.js": {
    buildRelativeUrl: "./index.js",
    runtimeCompat: { node: "18.0.0" },
  },
  "./src/cli.js": {
    buildRelativeUrl: "./cli.js", 
    runtimeCompat: { node: "18.0.0" },
  },
  "./src/utils.js": {
    buildRelativeUrl: "./utils.js",
    runtimeCompat: { node: "18.0.0" },
  },
},
```

## Building for Browser

Browser packages are typically used for:
- Client-side libraries
- Web components
- Frontend utilities
- Browser-specific APIs

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
      runtimeCompat: {
        chrome: "64",
        edge: "79", 
        firefox: "67",
        safari: "11.3",
      },
      format: "esm",
      minification: true,
      bundling: true,
      ignore: {
        "file://**/node_modules/": true,
      },
    },
  },
});
```

### Browser Package with UMD Format

For maximum compatibility, including older module systems:

```js
entryPoints: {
  "./src/index.js": {
    buildRelativeUrl: "./browser.umd.js",
    format: "umd",
    globalName: "MyLibrary", // Global variable name for UMD
    runtimeCompat: {
      chrome: "60",
      edge: "79",
      firefox: "60", 
      safari: "11",
    },
  },
},
```

## Building Universal Packages

Universal packages work in both Node.js and browser environments. This requires careful consideration of:
- Runtime-specific APIs
- Module formats
- Dependency management

### Dual Build Strategy

Create separate builds for each environment:

```js
// build.mjs
import { build } from "@jsenv/core";

await build({
  sourceDirectoryUrl: import.meta.resolve("../"),
  buildDirectoryUrl: import.meta.resolve("../dist/"),
  entryPoints: {
    // Node.js build
    "./src/index.js": {
      buildRelativeUrl: "./node.js",
      runtimeCompat: {
        node: "18.0.0",
      },
      format: "esm",
      ignore: {
        "file://**/node_modules/": true,
      },
    },
    // Browser build  
    "./src/index.js": {
      buildRelativeUrl: "./browser.js",
      runtimeCompat: {
        chrome: "64",
        edge: "79",
        firefox: "67", 
        safari: "11.3",
      },
      format: "esm",
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
      "node": "./dist/node.js",
      "browser": "./dist/browser.js", 
      "default": "./dist/browser.js"
    }
  },
  "main": "./dist/node.js",
  "browser": "./dist/browser.js"
}
```

## Advanced Package Configuration

### Preserving Comments and JSDoc

Useful for packages consumed by developers:

```js
entryPoints: {
  "./src/index.js": {
    buildRelativeUrl: "./index.js",
    minification: false, // Keep readable
    preserveComments: true, // Preserve JSDoc
    versioning: false, // No cache busting for packages
  },
},
```

### External Dependencies

Mark dependencies as external (not bundled):

```js
entryPoints: {
  "./src/index.js": {
    buildRelativeUrl: "./index.js", 
    external: ["react", "lodash"], // These won't be bundled
  },
},
```

### Conditional Builds

Build different versions based on conditions:

```js
const isProduction = process.env.NODE_ENV === "production";

entryPoints: {
  "./src/index.js": {
    buildRelativeUrl: "./index.js",
    minification: isProduction,
    bundling: isProduction,
    sourceMap: !isProduction,
  },
},
```

## Best Practices

1. **Choose the right format**: ESM for modern environments, CommonJS for legacy Node.js, UMD for maximum browser compatibility

2. **Manage dependencies carefully**: Use `ignore` for peer dependencies, `external` for runtime dependencies

3. **Consider file size**: Bundle for browser packages, keep dependencies external for Node.js packages when possible

4. **Version targeting**: Be specific about minimum versions to enable optimal transpilation

5. **Documentation**: Preserve comments and JSDoc for better developer experience

6. **Testing**: Test your built packages in the target environments before publishing

## Package Types Summary

| Package Type | Format | Runtime Compat | Bundling | Common Use Cases |
|-------------|--------|----------------|----------|------------------|
| Node.js | ESM/CommonJS | `node: "18.0.0"` | Optional | CLI tools, servers, build scripts |
| Browser | ESM/UMD | Browser versions | Recommended | Web libraries, components |
| Universal | Multiple builds | Both | Environment-specific | Utility libraries, data processing |

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