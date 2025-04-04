# snapshot

[![npm package](https://img.shields.io/npm/v/@jsenv/snapshot.svg?logo=npm&label=package)](https://www.npmjs.com/package/@jsenv/snapshot)

A powerful snapshot testing tool for JavaScript applications.

## Introduction to Snapshot Testing

Snapshot testing is a technique that:

1. Captures the output of code execution into files (snapshots)
2. Validates future code changes by:
   - Reading the existing snapshot
   - Executing the code
   - Generating a new snapshot
   - Comparing the two snapshots and reporting differences

This approach ensures your code continues to behave as expected by verifying its outputs remain consistent over time.

## How `@jsenv/snapshot` Works

When running tests:

- **First run**: If no snapshot exists, one will be generated without comparison
- **Subsequent runs**: Snapshots are compared with the following behavior:
  - In CI environments (`process.env.CI` is set): An error is thrown if differences are detected
  - Locally: No error is thrown, allowing you to review changes with tools like git diff

> **Note**: All functions accept a throwWhenDiff parameter to force errors even in local environments.

## API Reference

### takeFileSnapshot(fileUrl)

Captures and compares the state of a specific file.

```js
import { writeFileSync } from "node:fs";
import { takeFileSnapshot } from "@jsenv/snapshot";

const fileTxtUrl = new URL("./file.txt", import.meta.url);
const writeFileTxt = (content) => {
  writeFileSync(writeFileTxt, content);
};

// take snapshot of "./file.txt"
const fileSnapshot = takeFileSnapshot(fileTxtUrl);
writeFileTxt("Hello world");
// compare the state of "./file.txt" with previous version
fileSnapshot.compare();
```

### takeDirectorySnapshot(directoryUrl)

Captures and compares the state of an entire directory.

```js
import { writeFileSync } from "node:fs";
import { takeDirectorySnapshot } from "@jsenv/snapshot";

const directoryUrl = new URL("./dir/", import.meta.url);
const writeManyFiles = () => {
  writeFileSync(new URL("./a.txt", directoryUrl), "a");
  writeFileSync(new URL("./b.txt", directoryUrl), "b");
};

// take snapshot of "./dir/"
const directorySnapshot = takeDirectorySnapshot(directoryUrl);
writeFileTxt(directoryUrl);
// compare the state of "./dir/" with previous version
directorySnapshot.compare();
```

### snapshotTests(testFileUrl, fnRegistertingTests, options)

The most powerful feature of this library - creates readable markdown snapshots of test executions.

```js
import { snapshotTests } from "@jsenv/snapshot";

const getCircleArea = (circleRadius) => {
  if (isNaN(circleRadius)) {
    throw new TypeError(
      `circleRadius must be a number, received ${circleRadius}`,
    );
  }
  return circleRadius * circleRadius * Math.PI;
};

await snapshotTests(import.meta.url, ({ test }) => {
  test("when radius is 2", () => {
    return getCircleArea(2);
  });

  test("when radius is 10", () => {
    return getCircleArea(10);
  });

  test("when radius is null", () => {
    return getCircleArea(null);
  });
});
```

This generates a markdown file documenting how your code behaves in different scenarios.
See an example at [./docs/\_circle_area.test.js/circle_area.test.js.md](./docs/_circle_area.test.js/circle_area.test.js.md)

## Why Use snapshotTests?

- **Assertion-free testing**: Simply call your functions and let the snapshots document their behavior
- **Self-documenting tests**: Markdown files serve as both test validation and documentation
- **Visual change reviews**: Code changes are reflected in snapshots, making reviews easy
- **Side effect tracking**: Automatically captures and documents:

  - Console logs [example](./docs/_log.test.js/log.test.js.md)
  - Filesystem operations [example](./docs/_filesystem.test.js/filesystem.test.js.md)
  - And more

- Fluctuating values are replaced with stable values, see [#Fluctuating values replacement](#fluctuating-values-replacement)

## Stable Snapshots Across Environments

To ensure snapshots remain consistent across different machines and CI environments, `@jsenv/snapshot` automatically normalizes fluctuating values:

- Time values like "2s" become "Xs"
- Filesystem paths are standardized
- Network ports in URLs are removed
- And much more...

This ensures your snapshot tests remain stable regardless of when or where they run.

## Advanced Examples

- Testing complex assertion behavior: [@jsenv/assert/tests/array.test.js.md](../assert/tests/_array.test.js/array.test.js.md)
- Testing server-side builds with browser execution: [@jsenv/core/tests/script_type_module_basic.test.mjs](../../../tests/build/basics/script_type_module_basic/_script_type_module_basic.test.mjs/script_type_module_basic.test.mjs.md)

## Contributing

If you encounter unstable snapshots due to fluctuating values not being properly normalized, please open an issue or submit a pull request.
