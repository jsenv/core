# eslint-config-relax

[![npm package](https://img.shields.io/npm/v/@jsenv/eslint-config-relax.svg?logo=npm&label=package)](https://www.npmjs.com/package/@jsenv/eslint-config-relax)

Two things:

1. ESLint should bother me only for important things
2. Share ESLint configuration for different types of project

## Usage

```console
npm i --save-dev @jsenv/eslint-config-relax
```

**eslint.config.js**

```js
import { eslintConfigRelax } from "@jsenv/eslint-config-relax";

export default eslintConfigRelax({
  rootDirectoryUrl: new URL("./", import.meta.url),
  browserDirectoryUrl: new URL("./src/", import.meta.url), // optional
});
```

## Best parts

- No need to configure ESLint; it is hard to do correctly
- Freedom in the code; rules coercing you to code in a certain way are disabled
- Import resolution works; The whole node esm resolution algorith is implemented

## To know

- No support for TypeScript (it's planned)
- Not compatible with ESLint < 8
