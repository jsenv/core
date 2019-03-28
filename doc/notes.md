## Commons js dependency not supported for browser

FOr now you cannot import something written in commonjs if you plan to execute it inside a browser.
For nodejs you can use `import.meta.require`

## Generator not supported

Because we miss a strategy to provide regeneratorRuntime and polyfill in general.

## Sourcemap broken

It's likely because `transform-async-to-promises` used together with `transform-modules-systemjs` generate bad sourcemap.
It means if you use async/await in a platform not supporting it, your sourcemap will not be able to point the original location.

## import.meta.require mandatory for native node module

An import like this one:

```js
import { readFile } from "fs"
```

Will work during developement but bundleNode will try
fo find a file named `fs`.

Instead, you have to write

```js
const { readFile } = import.meta.require("fs")
```

It would be possible to write a babel plugin named `transform-native-import-to-import-meta-require` so that you would'nt be forced to write `import.meta.require`.

This babel plugin would recognize every native node module import and turn it into an `import.meta.require`.
