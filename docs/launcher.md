# Table of contents

- [launcher](#launcher)
- [Browser launchers](#browser-launchers)
- [Passing options to a launcher](#passing-options-to-a-launcher)
- [List of available launcher](#List-of-available-launcher)

# launcher

A launcher is a function capable to launch a runtime environment to execute a file.<br />
You can use them to tell on which runtime to execute a file.<br />

For instance the following code would execute `/Users/you/directory/index.js` on Node.js.

```js
import { execute, launchNode } from "@jsenv/core"

execute({
  projectDirectoryUrl: "/Users/you/directory",
  fileRelativeUrl: "./index.js",
  launch: launchNode,
})
```

# Browser launchers

Jsenv uses [playwright](https://github.com/microsoft/playwright) to launch browser runtime environments. If you want to use one of the browser launcher (_launchChromium_, _launchFirefox_ or _launchWebkit_) you need to:

1. Install browser executable dependencies

```console
npx playwright install-deps
```

2. Install browser executable

```console
npx playwright install
```

See also how to install a single browser at https://playwright.dev/docs/test-install/#installing-a-single-browser-binary

# Passing options to a launcher

You can pass option to a runtime launcher but you have to be sure you forward the options it receives.<br />
By default `launchChromium` execute a file inside a headless chromium, but you can make it launch a chromium with a UI like this:

```js
import { execute, launchChromium } from "@jsenv/core"

execute({
  projectDirectoryUrl: "/Users/you/directory",
  fileRelativeUrl: "./index.js",
  launch: launchChromium,
  launchParams: {
    headless: false,
  },
})
```

# List of available launcher

- [launchChromium](../src/launchBrowser.js)
- [launchChromiumTab](../src/launchBrowser.js)
- [launchFirefox](../src/launchBrowser.js)
- [launchFirefoxTab](../src/launchBrowser.js)
- [launchWebkit](../src/launchBrowser.js)
- [launchWebkitTab](../src/launchBrowser.js)
- [launchNode](../src/launchNode.js)
