https://developer.mozilla.org/en-US/docs/Web/JavaScript/Guide/Modules

### Import maps

> This proposal allows control over what URLs get fetched by JavaScript import statements and import() expressions. This allows "bare import specifiers", such as import moment from "moment", to work.
>
> — Domenic Denicola in [WICG/import-maps](https://github.com/WICG/import-maps#the-basic-idea)

The following html can be used with jsenv:

```html
<!DOCTYPE html>
<html>
  <head>
    <title>Title</title>
    <meta charset="utf-8" />
    <script type="importmap">
      {
        "imports": {
          "moment": "./node_modules/moment/index.js"
        }
      }
    </script>
  </head>

  <body>
    <script type="module">
      import moment from "moment"
      console.log(moment)
    </script>
  </body>
</html>
```

By the way, if your code uses node module resolution, [@jsenv/node-module-import-map](https://github.com/jsenv/jsenv-node-module-import-map#node-module-import-map) can generate importmap for you.

### Top level await

> Top-Level await has moved to stage 3, so the answer to your question How can I use async/await at the top level? is to just add await the call to main()
>
> — Taro in [How can I use async/await at the top level?](https://stackoverflow.com/a/56590390/2634179)

Top level await allows jsenv to know when a file code is done executing. This is used to kill a file that is too long to execute and know when to collect code coverage.

### Dynamic import

> The lazy-loading capabilities enabled by dynamic import() can be quite powerful when applied correctly. For demonstration purposes, Addy modified an example Hacker News PWA that statically imported all its dependencies, including comments, on first load. The updated version uses dynamic import() to lazily load the comments, avoiding the load, parse, and compile cost until the user really needs them.
>
> — Mathias Bynens on [Dynamic import()](https://v8.dev/features/dynamic-import#dynamic)

### import.meta.url

> It's a proposal to add the ability for ES modules to figure out what their file name or full path is. This behaves similarly to \_\_dirname in Node which prints out the file path to the current module. According to caniuse, most browsers already support it (including the latest Chromium Edge)
>
> — Jake Deichert on [A Super Hacky Alternative to import.meta.url](https://jakedeichert.com/blog/2020/02/a-super-hacky-alternative-to-import-meta-url/)
