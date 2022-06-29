# Using ressources from CDN

This documentation explains what happens if you use ressources from a CDN.

Let's take HTML loading roboto font from google CDNs as an example:

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Title</title>
    <meta charset="utf-8" />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Roboto"
      crossorigin="anonymous"
    />
    <style>
      body {
        font-family: Roboto;
      }
    </style>
  </head>

  <body>
    Hello world
  </body>
</html>
```

If we build this file with jsenv, the cross origin url is kept intact for files generated during the build.

<!-- Part below commented until the jsenv plugin for http urls is done -->
<!-- There is 2 circumstances where you might want to change this default behaviour:

1. You want to remove dependency to external urls in your build files
2. You want to transform code served by the CDN before it gets executed

## Remove CDN urls during build

Pass "preservedUrls" to "buildProject".

```diff
import { buildProject } from "@jsenv/core"

await buildProject({
  projectDirectoryUrl: new URL("./", import.meta.url),
  buildDirectoryRelativeUrl: "dist",
  entryPoints: {
    "./main.html": "main.prod.html",
  },
  format: "esmodule",
+ preservedUrls: {
+   "https://fonts.googleapis.com/": false
+ }
})
```

Each url associated to false using "preservedUrls" will be fetched and turned into a file. The HTML file generated in the build directory will use a relative url instead of the CDN url.

```diff
<link
   rel="stylesheet"
-  href="https://fonts.googleapis.com/css2?family=Roboto"
+  href="assets/roboto_32789f.css"
/>
```

## Transform code served by CDN

For this use case let's assume you want to execute JavaScript from a CDN but code served by the CDN cannot be executed as it is. For example if you need to support old browsers where import/export is not supported.

```js
import { h, render } from "https://cdn.skypack.dev/preact@10.6.4"
```

To make this happen, tell jsenv it can transform code behind "`https://cdn.skypack.dev/preact@10.6.4`" using "preservedUrls":

```diff
import { buildProject } from "@jsenv/core"

await buildProject({
  projectDirectoryUrl: new URL("./", import.meta.url),
  buildDirectoryRelativeUrl: "dist",
  entryPoints: {
    "./main.html": "main.prod.html",
  },
  format: "esmodule",
+ preservedUrls: {
+   "https://cdn.skypack.dev/preact@10.6.4": false
+ }
})
```

When you pass a custom "preservedUrls" to "buildProject" it's recommended to also pass it to "startDevServer" and "executeTestPlan". -->
