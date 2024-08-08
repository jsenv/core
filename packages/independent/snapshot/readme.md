# snapshot

[![npm package](https://img.shields.io/npm/v/@jsenv/snapshot.svg?logo=npm&label=package)](https://www.npmjs.com/package/@jsenv/snapshot)

A tool to generate snapshots during tests.

## A word on snapshot testing

Snapshot testing consists into:

1. Making code execution produce file(s). They are called snapshots.
2. Make further code execution follow these steps:
    1. Read existing snapshot
    2. Execute code
    3. Read new snapshot
    4. Compare existing and new snapshot and throw if there is a diff

This force code execution to produce the same snapshots. Meaning that code being tested still behave as expected.

## How it works

`@jsenv/snapshot` behaves as follow:

The very first time code is executed, there is no pre-existing snapshots, files are written on the filesystem.

For all next code executions, snapshots are compared but `@jsenv/snapshot` will remain silent in case of diff.
It's only if code is executed in CI (`process.env.CI`) that an error will be thrown.
Locally it's your job to review eventual diff in the snapshots (`git diff`).

In the CI any diff will throw an error.

> Every function accepts a `throwWhenDiff` param to throw even if runned locally. You can also set `process.env.CI` before executing your code.

## takeFileSnapshot(fileUrl)

```js
import { writeFileSync } from "node:fs";
import { takeFileSnapshot } from "@jsenv/snapshot";

const writeFileTxt = (directoryUrl) => {
  writeFileSync(new URL("./file.txt", directoryUrl), "Hello");
};

// take snapshot of "dir/"
const fileSnapshot = takeFileSnapshot(
  new URL("./dir/file.txt", import.meta.url),
);
writeFileTxt(new URL("./dir/", import.meta.url));
// compare the state of "./dit/file.txt" with previous version
fileSnapshot.compare();
```

The code below ensure `writeFileTxt` always write one file: "file.txt" with the content "Hello".
Updating the code of `writeFileTxt` would fail snapshot comparison.

## takeDirectorySnapshot(directoryUrl)

```js
import { writeFileSync } from "node:fs";
import { takeDirectorySnapshot } from "@jsenv/snapshot";

const writeManyFiles = (directoryUrl) => {
  writeFileSync(new URL("./a.txt", directoryUrl), "a");
  writeFileSync(new URL("./b.txt", directoryUrl), "b");
};

// take snapshot of "dir/"
const directorySnapshot = takeDirectorySnapshot(
  new URL("./dir/", import.meta.url),
);
writeFileTxt(new URL("./dir/", import.meta.url));
// compare the state of "dir/" with previous version
directorySnapshot.compare();
```

The code below ensure `writeManyFiles` always write twos file: "a.txt" and "b.txt" with the content "a" and "b".
Updating the code of `writeManyFiles` would fail snapshot comparison.

## snapshotTests(testFileUrl, fnRegistertingTests, options)

This function is wonderful:

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

The code above is executing `getCircleArea` and produces a markdown files describing how it goes.  
See the markdown at [./docs/\_circle_area.test.js/circle_area.test.js.md](./docs/_circle_area.test.js/circle_area.test.js.md)

Why is it so wonderful?

- You don't have to assert anything, you just call the function
- The markdown files can be reviewed to ensure it is what you expect
- The markdown files can be used as documentation
- Changes in the source code would be reflected in the markdown making it easy to review

There is a few more very helpul things hapenning:

- Log side effects are catched, see [./docs/\_logs.test.js/log.test.js.md](./docs/_log.test.js/log.test.js.md)
- Filesystem side effects are catched and undone, see [./docs/\_filesystem.test.js/filesystem.test.js.md](./docs/_filesystem.test.js/filesystem.test.js.md)
- Fluctuating values are replaced with stable values (see next secion)

### Fluctuating values replacement

`@jsenv/snapshot` is meant to be executed once on your machine (or the machine of an other contributor) then on the CI.

Each of these execution happens in a specific context: time, operating system, filesystem location, ...
This context influences the behavior of the code.

Things like error stack traces, logs, the content of the file being produced.

To ensure the snapshot generated is predictible and the same accross context, all fluctuating values are replaced with stable values.

- Filesystem urls dynamic parts are replaced
- Port in https urls is removed
- Things like "2s" becomes "Xs"
- And so on

If something is fluctuating and makes your snapshot testing fail, you can an issue or create a pull request.
