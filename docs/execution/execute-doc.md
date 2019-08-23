## `execute`

Documents how `execute` function behaves.

## `execute` return value

return value example

```json
{
  "status": "completed",
  "namespace": {
    "default": 42
  }
}
```

## `execute` options

### launch

```js
const { launchChromium } = require('@jsenv/chromium-launcher')

execute({
  projectPath: '/Users/you/project'
  fileRelativePath: `/index.js`,
  launch: launchChromium,
})
```

This option is **required**.<br />
It is a function capable to launch a platform to execute a file inside it.
You're not likely going to write your own `launch` function, jsenv provides them.<br />
— see [platform launcher](../platform-launcher/platform-launcher.md)

### fileRelativePath

```js
import { execute } from '@jsenv/execution'
import { launchNode } from '@jsenv/node-launcher'

execute({
  projectPath: '/Users/you/project'
  fileRelativePath: `/index.js`,
  launch: launchNode,
})
```

This option is **required**.<br />
It is a string leading to the file you want to execute.<br />
It is relative to `projectPath`.

### mirrorConsole

```js
import { execute } from '@jsenv/execution'
import { launchNode } from '@jsenv/node-launcher'

execute({
  projectPath: '/Users/you/project'
  fileRelativePath: `/index.js`,
  launch: launchNode,
  mirrorConsole: true
})
```

When true, logs of the launched browser or node process will also be logged in your terminal.

If you don't pass this option, the default value will be:

```js
true
```

### stopOnceExecuted

```js
import { execute } from '@jsenv/execution'
import { launchNode } from '@jsenv/node-launcher'

execute({
  projectPath: '/Users/you/project'
  fileRelativePath: `/index.js`,
  launch: launchNode,
  stopOnceExecuted: true
})
```

When true, the platform will be stopped once the file execution is done.

This option kills the browser or node process when the file execution is done. This option is used by unit tests for instance that does not want to keep things alive.

If you don't pass this option, the default value will be:

```js
false
```

### projectPath

— see [generic documentation for projectPath](../shared-options/shared-options.md#projectpath)

### babelPluginMap

— see [generic documentation for babelPluginMap](../shared-options/shared-options.md#babelpluginmap)

### convertMap

— see [generic documentation for convertMap](../shared-options/shared-options.md#convertmap)

### importMapRelativePath

— see [generic documentation for importMapRelativePath](../shared-options/shared-options.md#importmaprelativepath)

### importDefaultExtension

— see [generic documentation for importDefaultExtension](../shared-options/shared-options.md#importdefaultextension)

### compileIntoRelativePath

— see [generic documentation for compileIntoRelativePath](../shared-options/shared-options.md#compileintorelativepath)
