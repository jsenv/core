# Dynamic import worker

[![npm package](https://img.shields.io/npm/v/@jsenv/dynamic-import-worker.svg?logo=npm&label=package)](https://www.npmjs.com/package/@jsenv/dynamic-import-worker)

Bypass node cache on dynamic import thanks to worker

# Example

_docs/demo/random_number.mjs_

```js
export const randomNumber = Math.random();
```

_docs/demo/demo.mjs_

```js
import { importOneExportFromFile } from "@jsenv/dynamic-import-worker";

const randomNumberFileUrl = new URL(
  "./random_number.mjs#randomNumber",
  import.meta.url,
);

const randomNumberA = await importOneExportFromFile(randomNumberExportUrl);
const randomNumberB = await importOneExportFromFile(randomNumberExportUrl);

console.log(randomNumberA);
console.log(randomNumberB);
```

```console
> node ./docs/demo/demo.mjs
0.5362418125287491
0.35129949391010595
```
