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
   4. Compare the two snapshots and throw if there is a diff

This force code execution to produce the same snapshots. Meaning that code being tested still behave as expected.

## How it works

`@jsenv/snapshot` behaves as follow:

When there is no snapshot(s), the snapshot won't be compared. It happens the very first time you generate snapshots or because all snapshot files have been removed for some reason.

For all next code executions, snapshots are compared and

- An error is thrown when `process.env.CI` is set (code is executed in CI).
- Otherwise nothing special happens (it's your job to review eventual diff in the snapshots, using `git diff` for example)

> Every function accepts a `throwWhenDiff` param to throw even if runned locally. You can also set `process.env.CI` before executing your code.

## takeFileSnapshot(fileUrl)

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

The code below ensure `writeFileTxt` write `content` into "./file.txt".  
Changing that behaviour would fail snapshot comparison.

## takeDirectorySnapshot(directoryUrl)

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

The code below ensure `writeManyFiles` always write twos file: "./dir/a.txt" and "./dir/b.txt" with the content "a" and "b".  
Changing that behaviour would fail snapshot comparison.

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
This markdown will be compared with any previous version ensuring `getCircleArea` still behave as expected.

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
