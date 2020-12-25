# Jsenv compile server explained

_An high level overview of how jsenv server works internally_.

# Features

- Compiles exactly what is needed on demand
  - server starts very quickly
- File compiled version are written on disk and reused
  - compiled once until source file is modified
  - next run is fast as it reuse the compiled version right away
  - **you can see the compiled file version with your own eyes**

# How it works

Assuming jsenv serves your project at `http://localhost` and your project directory contains the following files

  <details>
    <summary>index.js</summary>

```js
const whatever = 42
console.log(whatever)
```

  </details>

A request to `http://localhost/index.js` returns `index.js` file untouched.

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

That being said, you can use this behaviour on purpose to prevent compilation of some files.

## What happens for assets?

If server is requested to compile a file but has no compiler associated, it will redirect to the original file. As there is no compiler for `.ico` files, following html would get the original `favicon.ico` file.

```html
<link rel="favicon" href="./favicon.ico" />
```

## Why `.jsenv/out/best/` and not just `.jsenv/` or `.compiled/`?

The answer is jsenv needs 3 directories:

`.jsenv` in case jsenv server needs to write some files unrelated to the compilation.<br/>
`.jsenv/out` is used to write some meta information about the compilation.<br/>
`.jsenv/best` or `.jsenv/otherwise`: used to write the compiled file version cache.<br/>

> It's possible to control `.jsenv` directory name using an undocumented parameter called `jsenvDirectoryRelativeUrl`

## What is `best` in `.jsenv/out/best/`?

It represent a compilation profile. Depending on the browser you are using, you will be redirected either to `.jsenv/out/best` or `.jsenv/out/otherwise`. `otherwise` applies all babel plugin to transform js and make it compatible with old browsers. `best` applies less transformation. It's an implementation detail and not really important to be aware of.
In practice if you use chrome you will be redirected to `.jsenv/out/best`, but you can still manually enter `otherwise` in the url to see the js that would be served to old browsers.
