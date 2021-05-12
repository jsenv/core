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

jsenv uses [playwright](https://github.com/microsoft/playwright) to launch browser runtime environments. If you want to use a browser launcher (launchChromium, launchFirefox or launchWebkit) you need to have the browser executable file somewhere in your project.

For instance if you plan to use `launchChromium`, add `playwright-chromium` to your devDependencies.

```console
npm install --save-dev playwright-chromium
```

For `launchFirefox` you would add `playwright-firefox`

```console
npm install --save-dev playwright-firefox
```

For `launchWebkit` you would add `playwright-webkit`

```console
npm install --save-dev playwright-webkit
```

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
