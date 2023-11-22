# snapshots [![npm package](https://img.shields.io/npm/v/@jsenv/snapshot.svg?logo=npm&label=package)](https://www.npmjs.com/package/@jsenv/snapshot)

## takeDirectorySnapshot

This function write all files from a directory to an other called "snapshots directory".

If the snapshots directory does not exists the function stops there.
If the snapshots directory exists the function throw an error if the content differs from the source directory.

### Behaviour when snapshots directory does not exists

```
project/
  dist/
    index.html
```

```js
import { takeDirectorySnapshot } from "@jsenv/snapshot";

takeDirectorySnapshot(
  new URL("./dist/", import.meta.url),
  new URL("./snapshots/", import.meta.url),
);
```

```diff
project/
  dist/
    index.html
+ snapshots/
+    index.html
```
