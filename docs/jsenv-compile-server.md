# Jsenv compile server

_An high level overview of how jsenv server works internally_.

# What compile server does

- It compiles exactly what is needed on demand:
  - server starts very quickly
- Compiled version of files are written on disk and reused:
  - Files are compiled once until source file is modified
  - Next run is fast as it reuses the compiled version right away
  - **you can see the compiled file version with your own eyes**
- Provides multiple compilation profiles:
  - Compatible with old browsers
  - Compiles less for a recent browser

# How it works

Assuming jsenv serves your project at `https://localhost` and your project directory contains the following file

_index.js_:

```js
const whatever = await Promise.resolve(42)
console.log(whatever)
```

As you open urls with your browser, jsenv performs feature detection on the browser and generates "compilation profiles". A compilation profile will perform exactly what should be done to make code compatible with a browser.

At the time of writing this documentation here is what would happen depending the web browser you use:

- Chrome:

  "index.js" is served untouched.

- Firefox, Safari, Edge:

  You are redirected to `https://localhost/.jsenv/out/index.js` with _index.js_ transformed:

  ```js
  System.register([], function () {
    "use strict"
    return {
      execute: async function () {
        const whatever = await Promise.resolve(42)
        console.log(whatever)
      },
    }
  })
  //# sourceMappingURL=main.js.map
  ```

- Other

  You are redirected to `https://localhost/.jsenv/out_1/index.js` with _index.js_ transformed:

  ```js
  System.register([], function () {
    "use strict"
    return {
      execute: function () {
        Promise.resolve(42).then((value) => {
          var whatever = value
          console.log(whatever)
        })
      },
    }
  })
  //# sourceMappingURL=main.js.map
  ```

When a request to `/.jsenv/out/index.js` is made, the server will not try to find a file there. Instead it reads `/index.js`, transforms it and return the transformed version. In addition the transformed file is written on the filesystem at `/jsenv/out/index.js`. This transformed file version is used as cache.

# Notes

## What is hapenning for relative url starting with `/`?

If the url specifier starts with `/`, server returns the project file.

```html
<script type="module" src="/index.js"></script>
```

This is because script asks to fetch `"/main.js"`. So even if you are in the compile directory at `https://localhost/.jsenv/out/index.html`, browser resolve script url to `https://localhost/index.js`.

So be sure to use relative notation instead: `"./index.js"`. In that case browser will resolve script url to `https://localhost/.jsenv/out/index.js`.

> You can use [import maps](https://github.com/jsenv/jsenv-template-pwa/blob/e06356f9df4c0e063b8f8275cf80433d56853f92/project.importmap#L3) to avoid ../../ hell in js files

You can also decide to use an url starting with `/` on purpose to avoid compilation of that file.

## What happens for assets?

If server is requested to compile a file but has no compiler associated, it will serve the original file. As there is no compiler for `.ico` files, following html would get the original `favicon.ico` file.

```html
<link rel="favicon" href="./favicon.ico" />
```

## Jsenv directory

- `.jsenv`

  Contains _n_ "compilation directories".

  It's possible to control this directory name using an undocumented parameter called `jsenvDirectoryRelativeUrl`

- `.jsenv/out`

  It's a compilation directory where compiled files will be written.
  It is generated dynamically depending the browser you are using

- `.jsenv/out_1`

  It's an other compilation directory where compilation slightly differs from an other compilation directory.

- `.jsenv/redirect/file.js`

  Can be used to be dynamically redirected where you should. Depending on your browser and if compilation is required to execute your files, you will be redirected to:

  1. `file.js`
  2. `.jsenv/out/file.js`
