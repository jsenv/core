# testing

It is a function capable to execute files on different platforms. By default it will log as it progresses and return an object containing every execution result.

This feature is provided by `@jsenv/core` which exports a function called `test`.<br />

This documentation explains how to use `test` inside a project.

## How to use

Using a basic project setup we'll see how to use `test` to create script you can run to execute all your unit tests.

### Basic project setup

```
root/
  src/
    platform-name.js
  test/
    platform-name.test.js
    platform-name.browser.test.js
    platform-name.node.test.js
  index.js
  package.json
```

`root/test/platform-name.test.js`

```js
import { getPlatformName } from "../index.js"

const actual = typeof getPlatformName
const expected = "function"

if (actual !== expected) throw new Error(`getPlatformName must be a ${expected}, got ${actual}`)
```

`root/test/platform-name.browser.test.js`

```js
import { getPlatformName } from "../index.js"

const actual = getPlatformName()
const expected = "browser"

if (actual !== expected) throw new Error(`getPlatformName must return ${expected}, got ${actual}`)
```

`root/test/platform-name.node.test.js`

```js
import { getPlatformName } from "../index.js"

const actual = getPlatformName()
const expected = "node"

if (actual !== expected) throw new Error(`getPlatformName must return ${expected}, got ${actual}`)
```

`root/index.js`

```js
export { getPlatformName } from "./src/platform-name.js"
```

`root/platform-name.js`

```js
export const getPlatformName = () => {
  if (typeof window === "object") return "browser"
  if (typeof global === "object") return "node"
  return "other"
}
```

`root/package.json`

```json
{
  "name": "whatever"
}
```

### How to use test to execute unit tests on different platforms

1. Generate `root/importMap.json` for the project.

```shell
npm install --save-dev @jsenv/node-module-import-map
node -e 'require("@jsenv/node-module-import-map").generateImportMapForProjectNodeModules({ projectPath: process.cwd() })'
```

2. install `@jsenv/core`

```shell
npm install --save-dev @jsenv/core
```

3. Create a script capable to execute unit tests.<br />

`root/execute-tests.js`

```js
const { launchChromium, launchNode, test } = require("@jsenv/core")

test({
  projectPath: __dirname,
  executeDescription: {
    "/test/*.test.js": {
      browser: {
        launch: launchChromium,
      },
      node: {
        launch: launchNode,
      },
    },
    "/test/*.test.browser.js": {
      browser: {
        launch: launchChromium,
      },
    },
    "/test/*.test.node.js": {
      node: {
        launch: launchNode,
      },
    },
  },
})
```

4. Run `root/execute-tests.js` we just created

```shell
node ./execute-tests.js
```

I made a video recording terminal during execution `root/execute-tests.js`. The gif below was generated from that video.

![test terminal recording](./test-terminal-recording.gif)
