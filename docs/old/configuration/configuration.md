# Configuration

It's recommend to put jsenv configuration in a top level file named _jsenv.config.mjs_.

The presence of a jsenv configuration file is **optional**.

```js
/*
 * This file exports configuration reused by other files such as
 *
 * scripts/test.mjs
 * scripts/build.mjs
 *
 * Read more at https://github.com/jsenv/core#configuration
 */

export const rootDirectoryUrl = new URL("./", import.meta.url)
```

_jsenv.config.mjs_ is meant to share configuration, other files will simply import what they need.

```diff
import { build } from '@jsenv/core'

+ import { rootDirectoryUrl } from "./jsenv.config.mjs"
```

> We recommend to use ".mjs" extension when a file is written for Node.js but you can name the file as you want, "jsenv.config.js" is fine too.
