# platform launcher

A platform launcher is a function capable to launch a platform to execute a file.<br />
You can use them to tell on which platform to execute a file.<br />

For instance the following code would execute `/Users/you/folder/index.js` on chromium.

```js
import { execute } from '@jsenv/core'
import { launchChromium } from `@jsenv/chromium-launcher`

execute({
  projectPath: '/Users/you/folder',
  fileRelativePath: '/index.js',
  launch: launchChromium
})
```

## Passing options to a platform launcher

You can pass option to a platform launcher but you have to be sure you forward the options it receives.<br />
By default `launchChromium` execute a file inside a headless chromium, but you can make it launch a chromium with a UI like this:

```js
import { execute } from '@jsenv/core'
import { launchChromium } from `@jsenv/chromium-launcher`

execute({
  projectPath: '/Users/you/folder',
  fileRelativePath: '/index.js',
  launch: (options) => launchChromium({ ...options, headless: false })
})
```

## List of platform launcher

- [node launcher](https://github.com/jsenv/jsenv-node-launcher)
- [chromium launcher](https://github.com/jsenv/jsenv-chromium-launcher)
