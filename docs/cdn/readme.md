# Using ressources from CDN

The following HTML file is loading the roboto font from google CDNs.

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Title</title>
    <meta charset="utf-8" />
    <link
      rel="stylesheet"
      href="https://fonts.googleapis.com/css2?family=Roboto"
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

Cross origin urls like this can be used in HTML, CSS and JavaScript.

By default jsenv keep cross origin urls untouched. There is 2 circumstances where it makes sense to change this behaviour:

1. You want to remove dependency to external urls in your build files
2. You want to transform code served by the CDN before it gets executed by the browser

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

Here you need to tell jsenv it is allowed to transform code behind "`https://cdn.skypack.dev/preact@10.6.4`". You can do this using "preservedUrls".

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

When you pass a custom "preservedUrls" to "buildProject" it's recommended to also pass it to "startDevServer" and "executeTestPlan".
