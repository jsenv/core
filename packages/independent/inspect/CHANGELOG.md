# 2.0.0

### Add `inspectFileSize(size)`

```js
import { inspectFileSize } from "@jsenv/inspect";

inspectFileSize(1100000); // 1.1 MB
```

### Add `inspectMemoryUsage(byte)`

```js
import { inspectMemoryUsage } from "@jsenv/inspect";

inspectMemoryUsage(1100); // 1.1 kB
```

### Add `inspectFileContent(fileContent, { line, column })`

```js
console.log(
  inspectFileContent(
    `const a = false;
const b = true;
const c = true;
const d = true;
const e = false;`,
    { line: 3, column: 1 },
  ),
);
```

```console
2 | const b = true;
3 | const c = true;
    ^
4 | const d = true;
```

### Add `inspectDuration(ms)`

```js
import { inspectDuration } from "@jsenv/inspect";

inspectDuration(1_421); // 1.4 seconds
inspectDuration(7_651_200); // 2 hours and 8 minutes
```
