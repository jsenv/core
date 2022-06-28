# Disable concatenation

By default js files are concatenated as much as possible. There is legitimates reasons to disable this behaviour. Merging `n` files into chunks poses two issues:

- On a big project it becomes very hard to know what ends up where.
  Tools like [webpack bundle analyzer](https://github.com/webpack-contrib/webpack-bundle-analyzer) exists to mitigate this but it's still hard to grasp what is going on.
- When a file part of a chunk is modified the entire chunk must be recreated. A returning user have to redownload/parse/execute the entire chunk even if you modified only one line in one file.

Disabling concatenation will fixe these two issues, but also means browser will have to create an http request per file. Thanks to http2, one connection can be reused to serve `n` files meaning concatenation becomes less crucial.

> It's still faster for a web browser to donwload/parse/execute one big file than doing the same for 50 tiny files.

I would consider the following before disabling concatenation:

- Is production server compatible with http2?
- Is there a friendly loading experience on the website? (A loading screen + a progress bar for instance)
- What type of user experience I want to favor: new users or returning users?

Use _jsConcatenation_ parameter to disable concatenation.

```js
import { buildProject } from "@jsenv/core"

await buildProject({
  projectDirectoryUrl: new URL("./", import.meta.url),
  format: "esmodule",
  jsConcatenation: false,
})
```
