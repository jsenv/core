# @jsenv/snapshot — context for AI assistants

`@jsenv/snapshot` is a snapshot testing tool. Its main export, `snapshotTests`,
runs test functions and writes a markdown file describing everything each one
did (return value, thrown error, console logs, file writes); comparing that
markdown across runs is what replaces assertions.

Where the answer is, by question:

- **What does the generated markdown look like, and how do I shape a test to
  get a readable snapshot** (JS value rendering, the return-a-string table
  case, log capture, filesystem capture, value normalization) →
  [snapshot_tests_behavior.md](./snapshot_tests_behavior.md). Read it before
  writing a `snapshotTests` test or interpreting a snapshot diff.
- **API surface and options** → the JSDoc on `snapshotTests` in
  [../src/side_effects/snapshot_tests.js](../src/side_effects/snapshot_tests.js),
  and the package [readme](../readme.md) for `takeFileSnapshot` /
  `takeDirectorySnapshot`.
- **Runnable examples** → the test files in this directory
  ([circle_area.test.js](./circle_area.test.js), [log.test.js](./log.test.js),
  [filesystem.test.js](./filesystem.test.js)) with their generated snapshots
  committed next to them in the `_*.test.js/` directories — each pair shows an
  input and exactly what it produces.
