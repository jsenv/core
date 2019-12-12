# platform launcher

A platform launcher is a function capable to launch a platform to execute a file.<br />
You can use them to tell on which platform to execute a file.<br />

For instance the following code would execute `/Users/you/directory/index.js` on chromium.

```js
const { execute, launchChromium } = require("@jsenv/core")

execute({
  projectDirectoryUrl: "/Users/you/directory",
  fileRelativeUrl: "./index.js",
  launch: launchChromium,
})
```

## Passing options to a platform launcher

You can pass option to a platform launcher but you have to be sure you forward the options it receives.<br />
By default `launchChromium` execute a file inside a headless chromium, but you can make it launch a chromium with a UI like this:

```js
const { execute, launchChromium } = require("@jsenv/core")

execute({
  projectDirectoryUrl: "/Users/you/directory",
  fileRelativeUrl: "./index.js",
  launch: (options) => launchChromium({ ...options, headless: false }),
})
```

## List of available platform launcher

- [launchChromium](../../src/launchChromium.js)
- [launchChromiumTab](../../src/launchChromiumTab.js)
- [launchNode](../../src/launchNode.js)

It is planned to add a firefox launcher but nothing was started yet.
If you want to write a firefox launcher or any other, feel free to open a draft pull request.
