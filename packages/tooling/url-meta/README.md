# @jsenv/url-meta [![npm package](https://img.shields.io/npm/v/@jsenv/url-meta.svg?logo=npm&label=package)](https://www.npmjs.com/package/@jsenv/url-meta)

Associate values to URLs using powerful pattern matching.

🔍 Match URLs using glob-like patterns  
🎯 Define URL-based configurations easily  
🌐 Support for file system operations and HTTP resources  
🧩 Compose complex pattern rules with simple syntax

## Table of Contents

- [@jsenv/url-meta ](#jsenvurl-meta-)
  - [Table of Contents](#table-of-contents)
  - [Quick Start](#quick-start)
  - [Pattern Matching](#pattern-matching)
  - [Associations](#associations)
  - [API Reference](#api-reference)
    - [applyAssociations](#applyassociations)
    - [resolveAssociations](#resolveassociations)
    - [patternToRegExp](#patterntoregexp)
  - [Advanced Usage](#advanced-usage)
    - [Multiple Property Associations](#multiple-property-associations)
    - [Boolean Logic with Patterns](#boolean-logic-with-patterns)

## Quick Start

```console
npm install @jsenv/url-meta
```

```js
import { URL_META } from "@jsenv/url-meta";

// Define associations between URL patterns and values
const associations = {
  color: {
    "file:///*": "black", // Default for all files
    "file:///*.js": "red", // JavaScript files are red
    "file:///*.css": "blue", // CSS files are blue
  },
};

const getUrlColor = (url) => {
  const { color } = URL_META.applyAssociations({ url, associations });
  return color;
};

console.log(`file.json color is ${getUrlColor("file:///file.json")}`);
console.log(`file.js color is ${getUrlColor("file:///file.js")}`);
console.log(`styles.css color is ${getUrlColor("file:///styles.css")}`);
```

_Code above logs_

```console
file.json color is black
file.js color is red
styles.css color is blue
```

## Pattern Matching

URL meta uses a powerful pattern matching syntax similar to glob patterns:

| Pattern            | Description                          | Example URL match                          |
| ------------------ | ------------------------------------ | ------------------------------------------ |
| `**/`              | Everything                           | `file:///any/path/`                        |
| `*/**/`            | Inside a directory                   | `file:///root/any/depth/`                  |
| `**/.*/`           | Inside directory starting with a dot | `file:///path/.hidden/`                    |
| `**/node_modules/` | Inside any `node_modules` directory  | `file:///project/node_modules/`            |
| `node_modules/`    | Inside root `node_modules` directory | `file:///node_modules/`                    |
| `**/*.map`         | Ending with `.map`                   | `file:///script.js.map`                    |
| `**/*.test.*`      | Contains `.test.`                    | `file:///module.test.js`                   |
| `*`                | Inside the root directory only       | `file:///file.js` (not `/dir/file.js`)     |
| `*/*`              | Inside a directory of depth 1        | `file:///dir/file.js` (not `/a/b/file.js`) |

For more details, see [pattern_matching.md](./pattern_matching.md)

## Associations

Associations map URL patterns to values. They're especially useful for:

- Setting file visibility rules
- Configuring build tools
- Defining testing strategies
- Specifying resource handling

Example: "Files are visible except those in .git/ directory"

```js
const associations = {
  visible: {
    "**/*/": true, // All directories are visible by default
    "**/.git/": false, // .git directories are not visible
  },
};
```

Associations are resolved in order with later patterns taking precedence when multiple patterns match a URL.

## API Reference

### applyAssociations

Applies pattern matching associations to a specific URL.

```js
import { URL_META } from "@jsenv/url-meta";

const { group, permission } = URL_META.applyAssociations({
  url: "file:///project/src/components/Button.js",
  associations: {
    group: {
      "file:///project/src/": "source",
      "file:///project/test/": "test",
    },
    permission: {
      "file:///project/**/*": "read",
      "file:///project/src/**/*": "write",
    },
  },
});

console.log(group); // "source"
console.log(permission); // "write"
```

### resolveAssociations

Resolves relative patterns in associations against a base URL.

```js
import { URL_META } from "@jsenv/url-meta";

const associations = URL_META.resolveAssociations(
  {
    visible: {
      "**/*/": true,
      "**/.git/": false,
    },
  },
  "file:///Users/directory/",
);

console.log(JSON.stringify(associations, null, "  "));
```

```json
{
  "visible": {
    "file:///Users/directory/**/*/": true,
    "file:///Users/directory/**/.git/": false
  }
}
```

### patternToRegExp

Converts a URL pattern to a regular expression for custom matching.

```js
import { URL_META } from "@jsenv/url-meta";

const pattern = "file:///*.js";
const regexp = URL_META.patternToRegExp(pattern);

console.log(regexp.test("file:///file.js")); // true
console.log(regexp.test("file:///dir/file.js")); // false (doesn't match subdirectories)
```

## Advanced Usage

### Multiple Property Associations

```js
import { URL_META } from "@jsenv/url-meta";

const fileAssociations = {
  // Define file types
  type: {
    "**/*.js": "javascript",
    "**/*.css": "stylesheet",
    "**/*.json": "json",
    "**/*.md": "markdown",
  },

  // Define build configurations
  build: {
    "**/*/": true,
    "**/*.test.js": false,
    "**/node_modules/": false,
  },

  // Define permissions
  permission: {
    "**/*/": "read",
    "src/**/*": "write",
    "dist/**/*": "none",
  },
};

const fileInfo = URL_META.applyAssociations({
  url: "file:///project/src/components/Button.js",
  associations: fileAssociations,
});

console.log(fileInfo);
// {
//   type: "javascript",
//   build: true,
//   permission: "write"
// }
```

### Boolean Logic with Patterns

```js
import { URL_META } from "@jsenv/url-meta";

// Define testing strategy
const testAssociations = {
  test: {
    // Test all JavaScript files
    "**/*.js": true,
    // Except those in node_modules
    "**/node_modules/": false,
    // And except build output
    "dist/": false,
    // But always test critical files regardless of location
    "**/critical/**/*.js": true,
  },
};
```
