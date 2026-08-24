# `snapshotTests` behavior — what gets captured, how it is rendered

`snapshotTests` turns a plain function into a test without assertions: it runs
the function, captures everything observable it did — the value it returned (or
the error it threw), what it logged, the files it wrote — and writes a markdown
file describing all of it. That markdown IS the assertion:

- **First run**: the markdown is written, nothing is compared.
- **Later runs**: the new markdown is compared to the one on disk. Locally a
  difference never throws — you review it with `git diff` like any code change.
  In CI (`process.env.CI` set) a difference throws. `throwWhenDiff: true`
  forces the CI behavior locally.

The practical consequence: a behavior change shows up as a readable diff in the
snapshot file, reviewed alongside the code change that caused it.

## Files on disk

```
some.test.mjs
_some.test.mjs/                      ← one directory per test file
  some.test.mjs.md                   ← index: links to each scenario
  0_first_scenario/
    0_first_scenario.md              ← snapshot of test #0
    ...                              ← files the test wrote, svg log renders…
  1_second_scenario/
    1_second_scenario.md
```

The location comes from `outFilePattern` (default
`./_[source_filename]/[filename]`). Each scenario file starts with the test
function's own source code (extracted automatically), followed by one section
per captured side effect. Sections are numbered (`# 1/2 logs`, `# 2/2 return`);
when the only side effect is the completion value, the heading is dropped and
the value block stands alone right after the source.

## Default rendering: JS values made readable

Whatever the test returns (or resolves) is rendered in a `js` block by
`@jsenv/humanize` — multi-line, 2-space indent, quotes picked automatically.
This default is good: return the raw object and let the rendering do the work,
don't pre-format values by hand when the structure is what matters.

```js
test("object return", () => {
  return { name: "toto", tags: ["a", "b"], count: 2 };
});
```

produces:

````markdown
```js
{
  "name": "toto",
  "tags": [
    "a",
    "b"
  ],
  "count": 2
}
```
````

`undefined` is shown as `undefined`. A thrown error (or a returned/rejected
one) is rendered as a stack trace with paths normalized, e.g.:

````markdown
```console
TypeError: circleRadius must be a number, received undefined
  at getCircleArea (base/circle_area.test.js:5:11)
  at base/circle_area.test.js:22:12
```
````

A common pattern for behavior documentation (see the navi route tests): return
one object gathering everything the scenario wants to show —

```js
return {
  url_before: urlBefore,
  url_after: urlAfter,
  should_be_same: urlBefore === urlAfter,
};
```

## Returning a string: rendered verbatim — the table case

A returned **string is not quoted**: it is injected as-is into the `js` block.
The test can therefore build its own presentation, and the most useful shape is
a table — one line per case, so a behavior change diffs down to exactly the
line of the case that changed:

```js
test("string widths", () => {
  const rows = [
    ["input", "width"],
    ...inputs.map((input) => [JSON.stringify(input), String(width(input))]),
  ];
  return rows.map(([a, b]) => `${a.padEnd(10)}| ${b}`).join("\n");
});
```

produces:

<!-- prettier-ignore -->
````markdown
```js
input     | width
"abcde"   | 5
"古池や"  | 6
```
````

The block is a code fence, so alignment comes from padding (`padEnd`), not from
markdown `|` table syntax — a markdown table inside a fence would just show its
pipes. Reach for this shape when one scenario covers many inputs; for a single
value the default rendering is better.

Reference at scale:
[terminal-text-size/tests/width.test.mjs](../../terminal-text-size/tests/width.test.mjs)
renders a comparison table of two implementations over ~80 inputs, snapshot in
[\_width.test.mjs/0_comparison/0_comparison.md](../../terminal-text-size/tests/_width.test.mjs/0_comparison/0_comparison.md).

## Logs

`console.debug/trace/info/log/warn/error` and `process.stdout/stderr` are
hooked while the test runs. Captured lines are grouped into a single `logs`
section rendered as a `console` block. Note: a `console.log` is captured both
as a console call and as the stdout write it performs, so each line currently
appears twice in snapshots.

Options via `logEffects`:

- `level` (default `"info"`): minimum level captured
  (`"debug" | "trace" | "info" | "warn" | "error" | "off"`)
- `group` (default `true`): merge consecutive logs into one section
- `prevent`: also silence the real console while capturing
- `onlyIfLevel`: drop all logs unless at least one reaches this level

When captured text contains ANSI escapes, the plain block is complemented by an
SVG render of the terminal output (written next to the markdown and embedded as
an image), with the raw text kept in a `<details>` fallback.

Runnable example: [log.test.js](./log.test.js) → generated output in
[\_log.test.js/](./_log.test.js/log.test.js.md).

## Filesystem

File writes performed by the test are captured as `write file "./file.txt"`
sections. The written content goes to a real file inside the scenario
directory, linked from the markdown — so the snapshot of a build test contains
the actual built files. With `filesystemEffects: { textualFilesInline: true }`
small textual files are inlined in the markdown instead (big ones still get a
dedicated file).

Key behaviors:

- **Effects are undone** when the test ends, by default
  (`filesystemEffects: { preserve: true }` keeps them).
- Paths in the markdown are made machine-independent: relative to
  `filesystemEffects.baseDirectory` (default: the test file's directory), and
  well-known locations are replaced by placeholders like `base/`, `cwd()/`.
- `filesystemActions` maps glob patterns to what the snapshot comparison does
  with matching files: `"compare"` (default), `"compare_presence_only"` (exists
  but content ignored — the default for `**/*.svg`), `"undo"`, `"ignore"`.

Runnable example: [filesystem.test.js](./filesystem.test.js) → generated output
in [\_filesystem.test.js/](./_filesystem.test.js/filesystem.test.js.md).

## Stability: fluctuating values are normalized

Everything rendered goes through a normalization pass so snapshots are
identical across machines and runs. Do not hand-write stabilization for these —
it is already done:

| Fluctuating value                                                                         | Rendered as           |
| ----------------------------------------------------------------------------------------- | --------------------- |
| Durations (`2.34s`, `3 seconds`)                                                          | `<X>s`, `<X> second`  |
| Filesystem paths (home, cwd, temp, the test's dir)                                        | `base/…`, `cwd()/…`   |
| `localhost:3467`, `[::1]:3467`                                                            | `127.0.0.1` (no port) |
| `?hot=1712345`                                                                            | `?hot=now()`          |
| `(node:12345)` warning prefixes                                                           | `(node:<X>)`          |
| ANSI escapes                                                                              | stripped              |
| Values under keys `timings`/`performance`/`memoryUsage`/`cpuUsage`/`os`/`date` in objects | `<X>`                 |

`preserveDurations: true` opts out of duration replacement when the test's
whole point is a duration string.

## Options worth knowing

- `test.ONLY("scenario", fn)` — run only this scenario; the other scenarios'
  snapshot directories are left untouched (not deleted, not compared).
- `snapshotTests.ignoreSideEffects(fn)` — run `fn` inside a test without
  capturing what it does (setup noise).
- `snapshotTests.prefConfigure(options)` — pre-declare options for the next
  `snapshotTests` call, keeping the call site clean.
- `executionEffects: { return: false }` — drop the return-value section;
  `{ catch: false }` — let errors propagate instead of being captured.
- The full option list is JSDoc'd on `snapshotTests` in
  [src/side_effects/snapshot_tests.js](../src/side_effects/snapshot_tests.js).
