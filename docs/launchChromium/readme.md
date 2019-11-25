## `launchChromium` options

### headless

> Controls launched chromium headless mode.

```js
import { launchChromium } from "@jsenv/chromium-launcher"

const launchChromiumWithInterface = (options) => launchChromium({ ...options, headless: false })
```

When true, launched chromium browser will be headless.<br />
When false, launched chromium browser will have a graphic interface.

If you don't pass `headless` option, its value will be:

```js
true
```
