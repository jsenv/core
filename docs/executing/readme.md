# Table of contents

- [Execute presentation](#execute-presentation)
- [Execute example](#execute-example)
- [Execute parameters](#execute-parameters)
- [Execute return value](#execute-return-value)

# Execute presentation

`execute` is a programmatic way to execute a file in a browser or Node.js and obtain meta information regarding the result of that execution.

Normally you don't need this because:

- If your file is written for a browser, [exploring server](../exploring/readme.md) is better in every aspect.
- If your file is written for Node.js, you can execute the file directly with the `node` command.

That being said, execute can still be useful, for instance to execute typescript files with Node.js without having to compile them beforehand.

# Execute example

`execute` is an async function launching a runtime, executing a file in it and returning the result of that execution.

```js
import { execute, launchNode } from "@jsenv/core"

const result = await execute({
  projectDirectoryUrl: new URL("./", import.meta.url),
  fileRelativeUrl: "./index.js",
  launch: launchNode,
})
```

— source code at [src/execute.js](../../src/execute.js).

# execute parameters

`execute` uses named parameters documented below.

<details>
  <summary>launch</summary>

`launch` parameter is a function capable to launch a runtime environment to execute a file in it. This parameter is **required**, the available launch functions are documented in [launcher](../launcher.md) documentation.

</details>

<details>
  <summary>fileRelativeUrl</summary>

`fileRelativeUrl` parameter is a relative url string leading to the file you want to execute. This parameter is **required**.

</details>

<details>
  <summary>mirrorConsole</summary>

`mirrorConsole` parameter is a boolean controlling if the runtime environment logs will appear in your terminal. This parameter is optional with a default value of `true`.

</details>

<details>
  <summary>stopAfterExecute</summary>

`stopAfterExecute` parameter is a boolean controlling if the runtime environment will be stopped once the file execution is done. This parameter is optional and disabled by default.

Stopping a runtime means killing the browser or node process when the file execution is done. Jsenv does nothing by default so that you decide when to stop it. When executing a test file jsenv stops runtime once execution result is known to avoid keeping things alive once the test is done.

For execution inside a browser it means you can see the output in the browser instance launched assuming it was launched in non-headless mode.

For node execution launched process is kept alive as long as the code uses api that keeps it alive such as setTimeout, setInterval or an http server listening.

</details>

<details>
  <summary>Shared parameters</summary>

To avoid duplication some parameter are linked to a generic documentation.

- [projectDirectoryUrl](../shared-parameters.md#projectDirectoryUrl)
- [babelPluginMap](../shared-parameters.md#babelPluginMap)
- [customCompilers](../shared-parameters.md#customCompilers)
- [importDefaultExtension](../shared-parameters.md#importDefaultExtension)
- [compileServerLogLevel](../shared-parameters.md#compileServerLogLevel)
- [compileServerProtocol](../shared-parameters.md#compileServerProtocol)
- [compileServerPrivateKey](../shared-parameters.md#compileServerPrivateKey)
- [compileServerCertificate](../shared-parameters.md#compileServerCertificate)
- [compileServerIp](../shared-parameters.md#compileServerIp)
- [compileServerPort](../shared-parameters.md#compileServerPort)
- [jsenvDirectoryRelativeUrl](../shared-parameters.md#compileDirectoryRelativeUrl)

</details>

# execute return value

`execute` returns signature is

```js
{
  status,
  error,
  namespace,
  consoleCalls,
  startMs,
  endMs,
  runtimeName,
  runtimeVersion,
}
```

<details>
  <summary>status</summary>

`status` is a string describing how the file execution went. The possible `status` are `"completed"`, `"errored"`, `"timedout"`, `"disconnected"`. The meaning of these status was already docummented in [How test is executed](../testing/readme.md#How-test-is-executed).

```js
import { execute } from "@jsenv/core"

const { status } = await execute({
  projectDirectoryUrl: __dirname,
  fileRelativeUrl: "./index.js",
})
```

</details>

<details>
  <summary>error</summary>

`error` is the value throw during the file execution. It is returned only if an error was thrown during file execution.

```js
import { execute } from "@jsenv/core"

const { error } = await execute({
  projectDirectoryUrl: new URL("./", import.meta.url),
  fileRelativeUrl: "./index.js",
})
```

</details>

<details>
  <summary>namespace</summary>

`namespace` is an object containing exports of the executed file.

```js
import { execute } from "@jsenv/core"

const { namespace } = await execute({
  projectDirectoryUrl: new URL("./", import.meta.url),
  fileRelativeUrl: "./index.js",
})
```

</details>

<details>
  <summary>consoleCalls</summary>

`consoleCalls` is an array describing all calls made to runtime console during the file execution. It is returned only when `captureConsole` is enabled.

```js
import { execute } from "@jsenv/core"

const { consoleCalls } = await execute({
  projectDirectoryUrl: new URL("./", import.meta.url),
  fileRelativeUrl: "./index.js",
  captureConsole: true, // without this consoleCalls is undefined
})
```

An example of `consoleCalls` could be

<!-- prettier-ignore -->
```js
[
  { type: "error", text: "An error occured" },
  { type: "log", text: "Hello world" },
]
```

</details>

<details>
  <summary>startMs and endMs</summary>

`startMs` parameter is a number representing the milliseconds at which execution started.<br />
`endMs` parameter is a number representing the milliseconds at which execution was done.<br />
These value are returned only when `measureDuration` is enabled.

startMs + endMs are meant to measure the duration of the execution. They can be converted to date by doing `new Date(startMs)`.

```js
import { execute } from "@jsenv/core"

const { startMs, endMs } = await execute({
  projectDirectoryUrl: new URL("./", import.meta.url),
  fileRelativeUrl: "./index.js",
  measureDuration: true, // without this startMs, endMs are undefined
})
```

</details>

<details>
  <summary>runTimeName</summary>

`runtimeName` is a string describing the runtime used to execute the file. It is returned only when `collectRuntimeName` is enabled. For now the possible runtimeName values are `"chromium"`, `"node"`, `"firefox"`, `"webkit"`.

```js
import { execute } from "@jsenv/core"

const { runtimeName } = await execute({
  projectDirectoryUrl: new URL("./", import.meta.url),
  fileRelativeUrl: "./index.js",
  collectRuntimeName: true, // without this runtimeName is undefined
})
```

</details>

<details>
  <summary>runtimeVersion</summary>

`runtimeVersion` is a string describing the runtime version used to execute the file. Use this to know the node version or browser version used to execute the file. It is returned only when `collectRuntimeVersion` is enabled.

```js
const { runtimeVersion } = await execute({
  projectDirectoryUrl: new URL("./", import.meta.url),
  fileRelativeUrl: "./index.js",
  collectRuntimeVersion: true, // without this runtimeVersion is undefined
})
```

</details>
