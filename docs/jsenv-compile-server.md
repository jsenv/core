# Jsenv compile server

_An high level overview of how jsenv server works internally_.

# What it does

- Compiles exactly what is needed on demand
  - server starts very quickly
- File compiled version are written on disk and reused
  - compiled once until source file is modified
  - next run is fast as it reuse the compiled version right away
  - **you can see the compiled file version with your own eyes**
- Different compilation profile
  - Compatible with an old browser
  - Compile less for a recent browser

# How it works

Assuming jsenv serves your project at `https://localhost` and your project directory contains the following index.js:

  <details>
    <summary>index.js</summary>

```js
const whatever = 42
console.log(whatever)
```

  </details>

A request to `https://localhost/index.js` returns `index.js` file untouched.

A request to `https://localhost/.jsenv/out/best/index.js` returns `index.js` transformed.

<details>
  <summary>/.jsenv/out/best/index.js response body</summary>

```js
System.register([], function () {
  "use strict"
  return {
    execute: function () {
      var whatever = 42
      console.log(whatever)
    },
  }
})

//# sourceMappingURL=main.js.map
```

</details>

When a request to `/.jsenv/out/best/index.js` is made, the server will not try to find a file there. Instead it will read `/index.js`, transform it and return the transformed version. In addition the transformed file is actually written on the filesystem at `/jsenv/out/best/index.js`. This transfromed file version is used as cache.

# Notes

## What is hapenning for relative url starting with `/`?

If the url specifier starts with `/`, server returns the project file.

```html
<script type="module" src="/index.js"></script>
```

This is because script asks to fetch `"/main.js"`. So even if you are in the compile directory at `https://localhost/.jsenv/out/best/index.html`, browser resolve script url to `https://localhost/index.js`.

So be sure to use relative notation instead: `"./index.js"`. In that case browser will resolve script url to `https://localhost/.jsenv/out/best/index.js`.

> You can use [import maps](https://github.com/jsenv/jsenv-template-pwa/blob/e06356f9df4c0e063b8f8275cf80433d56853f92/project.importmap#L3) to avoid ../../ hell in js files

You can also decide to use an url starting with `/` on purpose to avoid compilation of that file.

## What happens for assets?

If server is requested to compile a file but has no compiler associated, it will serve the original file. As there is no compiler for `.ico` files, following html would get the original `favicon.ico` file.

```html
<link rel="favicon" href="./favicon.ico" />
```

## What is `best` in `.jsenv/out/best/`?

It represent a compilation profile. Depending on the browser you are using, you will be redirected either to `.jsenv/out/best` or `.jsenv/out/otherwise`. `otherwise` applies all babel plugin to transform js and make it compatible with old browsers. `best` applies less transformation. It's an implementation detail and not really important to be aware of.
In practice if you use chrome you will be redirected to `.jsenv/out/best`, but you can still manually enter `otherwise` in the url to see the js that would be served to old browsers.

## Why `.jsenv/out/best/` and not just `.jsenv/` or `.compiled/`?

The compiled version of a given file depends on the parameters given to the compile server.
The best example of this would be that some babel plugins are enabled or not. So if you ever change the list of babel plugin enabled, the compiled files must be invalidated to be re-generated.

Whenever the compile server is started, it save parameters like babel plugins into `.jsenv/out/meta.json`. Next time the compile server is started it compare its parameters with `.jsenv/out/meta.json` and if something has changed, the cache is cleaned.

When file are builded, the compile server parameters are different. So if compile server had only one directory the following would happen:

- You execute your test -> cache generated for files without minification
- You build your project -> cache invalidated because parameters have changed
- You execute tour test -> cache invalidated again

To maximize cache reuse, compile server has two directory: `out` and `out-build`.

`.jsenv/out/best` is composed by the following parts.

`.jsenv`: used to contain `out` and `out-build`.

> It's possible to control `.jsenv` directory name using an undocumented parameter called `jsenvDirectoryRelativeUrl`

`.jsenv/out`: contains multiple directory like `best` or `otherwise`.

`.jsenv/out/best` or `.jsenv/out/otherwise`: contains compiled file version cache.
