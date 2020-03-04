# launcher

A launcher is a function capable to launch a runtime environment to execute a file.<br />
You can use them to tell on which runtime to execute a file.<br />

For instance the following code would execute `/Users/you/directory/index.js` on chromium.

```js
const { execute, launchChromium } = require("@jsenv/core")

execute({
  projectDirectoryUrl: "/Users/you/directory",
  fileRelativeUrl: "./index.js",
  launch: launchChromium,
})
```

## Passing options to a launcher

You can pass option to a runtime launcher but you have to be sure you forward the options it receives.<br />
By default `launchChromium` execute a file inside a headless chromium, but you can make it launch a chromium with a UI like this:

```js
const { execute, launchChromium } = require("@jsenv/core")

execute({
  projectDirectoryUrl: "/Users/you/directory",
  fileRelativeUrl: "./index.js",
  launch: (options) => launchChromium({ ...options, headless: false }),
})
```

## List of available launcher

- [launchChromium](../../src/launchBrowser.js)
- [launchChromiumTab](../../src/launchBrowser.js)
- [launchFirefox](../../src/launchBrowser.js)
- [launchFirefoxTab](../../src/launchBrowser.js)
- [launchWebkit](../../src/launchBrowser.js)
- [launchWebkitTab](../../src/launchBrowser.js)
- [launchNode](../../src/launchNode.js)
