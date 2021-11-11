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

A request to `https://localhost/index.js` returns _index.js_ untouched. A request to `https://localhost/.jsenv/dev/best/index.js` returns _index.js_ transformed.

_/.jsenv/dev/best/index.js response body:_

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

And a request to `https://localhost/.jsenv/dev/otherwise/index.js` returns _index.js_ with more transformations applied.

_/.jsenv/dev/otherwise/index.js response body:_

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

</details>

When a request to `/.jsenv/dev/best/index.js` is made, the server will not try to find a file there. Instead it reads `/index.js`, transforms it and return the transformed version. In addition the transformed file is written on the filesystem at `/jsenv/dev/best/index.js`. This transformed file version is used as cache.

# Notes

## What is hapenning for relative url starting with `/`?

If the url specifier starts with `/`, server returns the project file.

```html
<script type="module" src="/index.js"></script>
```

This is because script asks to fetch `"/main.js"`. So even if you are in the compile directory at `https://localhost/.jsenv/dev/best/index.html`, browser resolve script url to `https://localhost/index.js`.

So be sure to use relative notation instead: `"./index.js"`. In that case browser will resolve script url to `https://localhost/.jsenv/dev/best/index.js`.

> You can use [import maps](https://github.com/jsenv/jsenv-template-pwa/blob/e06356f9df4c0e063b8f8275cf80433d56853f92/project.importmap#L3) to avoid ../../ hell in js files

You can also decide to use an url starting with `/` on purpose to avoid compilation of that file.

## What happens for assets?

If server is requested to compile a file but has no compiler associated, it will serve the original file. As there is no compiler for `.ico` files, following html would get the original `favicon.ico` file.

```html
<link rel="favicon" href="./favicon.ico" />
```

## What is `.jsenv/dev/best/`?

- `.jsenv`

  Contains the 2 directories: `dev` and `build` explained below.

  It's possible to control this directory name using an undocumented parameter called `jsenvDirectoryRelativeUrl`

- `.jsenv/dev`

  Compile server has two directories where it writes compiled files: `dev` and `build`.
  It's required to use 2 different directories to keep cache for both scenarios: When files are compiled to be executed and when they are compiled for the build.

- `.jsenv/dev/best`

  Contains compiled version of project source files.

  `best` represents a compilation profile. Depending on the browser you are using, you will be redirected either to `.jsenv/dev/best` or `.jsenv/dev/otherwise`.

  `otherwise` applies all babel plugin to transform js and make it compatible with old browsers.

  `best` applies less transformation.

  It's an implementation detail and not really important to be aware of.
  In practice if you use chrome you will be redirected to `.jsenv/dev/best`, but you can still manually enter `otherwise` in the url to see the js that would be served to old browsers.
