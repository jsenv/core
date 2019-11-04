## Table of contents

- [Presentation](#Presentation)
- [Bundle to global](#bundle-to-global)
- [Bundle to systemjs](#bundle-to-systemjs)
- [Bundle to commonjs](#bundle-to-commonjs)
- [Code example](#code-example)
- [Concrete example](#concrete-example)
  - [Step 1 - Setup basic project](#step-1---setup-basic-project)
  - [Step 2 - Install dependencies](#step-2---install-dependencies)
  - [Step 3 - Generate bundles](#step-3---generate-bundles)
- [Installation](#installation)

## Presentation

`jsenv-bundling` github repository corresponds to `@jsenv/bundling` package published on github and npm package registries.

`@jsenv/bundling` can generates bundle for systemjs, commonjs or global (also known as iife). Each format takes is meant to be used in a specific way explained below.

## Bundle to global

Things to know about global bundle:

- Meant to run in a browser environment
- Needs collision free global variable
- Not compatible with code using dynamic import
- Not compatible with code using top level await

For example [docs/basic-project/index.js](./docs/basic-project/index.js) is bundled to [docs/basic-project/dist/global/main.js](./docs/basic-project/dist/global/main.js).

That global bundle could be used by

```html
<script src="./dist/global/main.js"></script>
<script>
  console.log(window.__whatever__)
</script>
```

## Bundle to systemjs

Things to know about systemjs bundle:

- Needs [systemjs](https://github.com/systemjs/systemjs) to be used
- Compatible with dynamic import
- Compatible with top level await

For example [docs/basic-project/index.js](./docs/basic-project/index.js) is bundled to [docs/basic-project/dist/systemjs/main.js](./docs/basic-project/dist/systemjs/main.js).

That systemjs bundle could be used by

```html
<script src="https://unpkg.com/systemjs@6.1.4/dist/system.js"></script>
<script>
  window.System.import("./dist/systemjs/main.js").then((namespace) => {
    console.log(namespace.default)
  })
</script>
```

## Bundle to commonjs

Things to know about commonjs bundle:

- Meant to be required in a node.js environment
- Not compatible with code using top level await

For example [docs/basic-project/index.js](./docs/basic-project/index.js) is bundled to [docs/basic-project/dist/commonjs/main.js](./docs/basic-project/dist/commonjs/main.js).

That commonjs bundle could be used by

```js
const exports = require("./dist/commonjs/main.js")

console.log(exports)
```

### Code example

The following code uses `@jsenv/bundling` to create a systemjs bundle for `index.js` entry point.

```js
const { generateSystemJsBundle } = require("@jsenv/bundling")

generateSystemJsBundle({
  projectDirectoryPath: __dirname,
  bundleDirectoryRelativePath: "./dist",
  entryPointMap: {
    main: "./index.js",
  },
})
```

If you want to know more about this function and others check [api documentation](./docs/api.md)

## Concrete example

This part explains how to setup a real environment to see `@jsenv/bundling` in action.<br />
You will setup a basic project where you can generate different bundle formats.

### Step 1 - Setup basic project

```console
git clone git@github.com:jsenv/jsenv-bundling.git
```

### Step 2 - Install dependencies

```console
cd ./jsenv-bundling/docs/basic-project
```

If you never configured npm authentification on github registry see [Configure npm authentification on github registry](https://github.com/jsenv/jsenv-core/blob/master/docs/installing-jsenv-package.md#configure-npm-authentification-on-github-registry) first.

```console
npm install
```

### Step 3 - Generate bundles

This project has preconfigured 3 bundle. You can generate them with the commands below:

- [docs/basic-project/dist/systemjs/main.js](./docs/basic-project/dist/systemjs/main.js)

  ```console
  node ./generate-systemjs-bundle.js
  ```

* [docs/basic-project/dist/global/main.js](./docs/basic-project/dist/global/main.js)

  ```console
  node ./generate-global-bundle.js
  ```

- [docs/basic-project/dist/commonjs/main.js](./docs/basic-project/dist/commonjs/main.js)

  ```console
  node ./generate-commonjs-bundle.js
  ```
