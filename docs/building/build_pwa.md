## Progressive Web Application (PWA)

There is a pre configured GitHub repository template for this use case: [jsenv-template-pwa](https://github.com/jsenv/jsenv-template-pwa#progressive-web-application-template).

If you want to build a PWA, you have a service worker file referenced somewhere by _navigator.serviceWorker.register_.

```html
<!DOCTYPE html>
<html>
  <head>
    <meta charset="utf8" />
    <link rel="icon" href="data:," />
  </head>
  <body>
    <script type="module">
      navigator.serviceWorker.register("/sw.js")
    </script>
  </body>
</html>
```

For this scenario, you must manually specify the usage of `"/sw.js"` to jsenv using _serviceWorkers_ parameter.

```js
import { buildProject } from "@jsenv/core"

await buildProject({
  projectDirectoryUrl: new URL("./", import.meta.url),
  serviceWorkers: {
    "./sw.js": "./sw.js",
  },
})
```

For each service worker file specified in _serviceWorkers_ a corresponding file will be written to the build directory. So if you forget to pass `"sw.js"` using _serviceWorkers_ parameter, `"sw.js"` won't be in the build directory.

A service worker file is special:

- you can use _self.importScripts_
- you cannot use _import_ keyword
- ...many more differences...

Jsenv won't try to change this.
So you must write the service worker file in a way that browser can understand.
During build, the following steps are taken for every service worker file specified in _serviceWorkers_:

1. Inline every _self.importScripts_
2. Minify the resulting service worker file
3. Write the final service worker file into the build directory

### Jsenv service worker

When generating the build jsenv knows every file used by your frontend files. This information can be injected into a service worker to preload or put into cache all these urls. This can be done with _serviceWorkerFinalizer_ as shown in the code below:

```diff
- import { buildProject } from "@jsenv/core"
+ import { buildProject, jsenvServiceWorkerFinalizer } from "@jsenv/core"

await buildProject({
  projectDirectoryUrl: new URL("./", import.meta.url),
  serviceWorkers: {
    "./sw.js": "./sw.js",
  },
+ serviceWorkerFinalizer: jsenvServiceWorkerFinalizer,
})
```

_serviceWorkerFinalizer_ injects a variable into the service worker file called `self.generatedUrlsConfig`. At this stage you can write your own service worker to do something with it. You can also use a service worker already written to handle this: https://github.com/jsenv/jsenv-pwa/blob/master/docs/jsenv-service-worker.md.
