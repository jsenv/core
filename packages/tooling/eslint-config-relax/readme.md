# eslint-config-relax

[![npm package](https://img.shields.io/npm/v/@jsenv/eslint-config-relax.svg?logo=npm&label=package)](https://www.npmjs.com/package/@jsenv/eslint-config-relax)

A pragmatic ESLint configuration that focuses on meaningful errors while giving you freedom to write code your way.

## Why Choose eslint-config-relax?

If you're tired of:

- Fighting with ESLint configuration
- Being forced to code in a specific style
- Module resolution errors in ESLint
- Noisy linting that focuses on trivial issues

eslint-config-relax lets you focus on writing code while still catching potential bugs and serious issues.

## Quick setup

```console
npm i --save-dev @jsenv/eslint-config-relax
```

Create an `eslint.config.js` file at your project root:

```js
import { eslintConfigRelax } from "@jsenv/eslint-config-relax";

export default eslintConfigRelax({
  rootDirectoryUrl: import.meta.resolve("./"),
  browserDirectoryUrl: import.meta.resolve("./src/"), // optional
});
```

## Key Features

### Focus on Real Issues

We disable rules that are:

- Purely stylistic
- Too opinionated
- More annoying than helpful

So you only see warnings that actually matter for code quality.

### Working Import Resolution

Full implementation of Node.js ESM resolution algorithm means:

- No more "Unable to resolve path to module" errors for valid imports
- Correct browser vs Node.js environment detection
- Proper handling of package exports

### Modern & Simple

- Uses ESLint's flat config system
- No complex plugin chains or configuration inheritance
- Works across various project types with minimal setup

### Environment Aware

Automatically adjusts rules based on your code's environment:

- Browser-specific checks for browser code
- Node.js-specific checks for server code

## Technical Notes

- Requires ESLint 8.0 or higher (uses flat config)
- TypeScript support planned for future releases
- Works with any project structure

## Example project structure

```
your-project/
├── eslint.config.js
├── package.json
├── src/                // Browser code
│   └── browser-specific-code.js
└── server/             // Node.js code
    └── node-specific-code.js
```

Migrate from traditional ESLint and enjoy writing code that's checked for what matters, not how it looks.
