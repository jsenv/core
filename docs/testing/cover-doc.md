# `cover`

Documents how `cover` function behaves.

## `cover` options

### coverDescription

```js
const { cover } = require("@jsenv/testing")

cover({
  projectPath: "/Users/you/folder",
  coverDescription: {
    "/src/**/*.js": true,
    "/src/whatever/**/*.js": false,
  },
})
```

It describes files of your project that should be covered.<br />
Example above means:

- a file ending with `.js`, anywhere inside `/src/` must be covered
- a file ending with `.js`, anywhere inside `/src/whatever/` does'nt have to be covered

This option internally uses path matching provided by `@jsenv/url-meta`.<br />
— see [@jsenv/url-meta on github](https://github.com/jsenv/jsenv-url-meta)

It is used to know what files you want to cover so that if your test does not cover them, an empty coverage gets generated on them.

If you don't pass this option, the default value will be:

```json
{
  "/index.js": true,
  "/src/**/*.js": true,
  "/**/*.test.*": false,
  "/**/test/": false
}
```

### coverageJsonReport

```js
const { cover } = require("@jsenv/testing")

cover({
  projectPath: "/Users/you/folder",
  coverageJsonReport: false,
})
```

When true, `cover` will write a json file describing your project coverage.

If you don't pass this option, the default value will be:

```js
true
```

### coverageJsonReportLog

```js
const { cover } = require("@jsenv/testing")

cover({
  projectPath: "/Users/you/folder",
  coverageJsonReportLog: false,
})
```

When both `coverageJsonReport` and this option are true, `cover` logs path of the coverage file after it is written.

If you don't pass this option, the default value will be:

```js
true
```

### coverageJsonReportRelativePath

```js
const { cover } = require("@jsenv/testing")

cover({
  projectPath: "/Users/you/folder",
  coverageJsonReportRelativePath: "/coverage/whatever.json",
})
```

If `coverageJsonReport` option is true, `cover` write the file here.

If you don't pass this option, the default value will be:

```js
"/coverage/coverage-final.json"
```

### generateMissedCoverage

```js
const { cover } = require("@jsenv/testing")

cover({
  projectPath: "/Users/you/folder",
  generateMissedCoverage: false,
})
```

When true, `cover` will generate an empty coverage for every file present in `coverDescription` options but never imported by test files.

If you don't pass this option, the default value will be:

```js
true
```

### executeDescription

— see [test documentation for executeDescription](./test-doc.md#executedescription)

### defaultAllocatedMsPerExecution

— see [test documentation for defaultAllocatedMsPerExecution](./test-doc.md#defaultallocatedmsperexecution)

### maxParallelExecution

— see [test documentation for maxParallelExecution](./test-doc.md#maxparallelexecution)

### measureDuration

— see [test documentation for measureDuration](./test-doc.md#measureduration)

### captureConsole

— see [test documentation for captureConsole](./test-doc.md#captureconsole)

### projectPath

— see [generic documentation for projectPath](https://github.com/jsenv/jsenv-core/blob/master/docs/shared-options/shared-options.md#projectpath)

### babelPluginMap

— see [generic documentation for babelPluginMap](https://github.com/jsenv/jsenv-core/blob/master/docs/shared-options/shared-options.md#babelpluginmap)

### convertMap

— see [generic documentation for convertMap](../shared-options/shared-options.md#convertmap)

### importMapRelativePath

— see [generic documentation for importMapRelativePath](https://github.com/jsenv/jsenv-core/blob/master/docs/shared-options/shared-options.md#importmaprelativepath)

### importDefaultExtension

— see [generic documentation for importDefaultExtension](https://github.com/jsenv/jsenv-core/blob/master/docs/shared-options/shared-options.md#importdefaultextension)

### compileIntoRelativePath

— see [generic documentation for compileIntoRelativePath](https://github.com/jsenv/jsenv-core/blob/master/docs/shared-options/shared-options.md#compileintorelativepath)
