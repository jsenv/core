## `chromiumRuntime` params

### headless

> Controls launched chromium headless mode.

```js
import { chromiumRuntime } from "@jsenv/chromium-launcher"

const chromiumRuntimeWithInterface = (options) =>
  chromiumRuntime({ ...options, headless: false })
```

When true, launched chromium browser will be headless.<br />
When false, launched chromium browser will have a graphic interface.

If you don't pass `headless` option, its value will be:

```js
true
```
