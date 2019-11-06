## `launchNode` options

### env

> Object that will be merged into `process.ENV` of child process.

If you don't pass `env` options, its value will be:

<!-- prettier-ignore -->
```js
{}
```

### debugPort

> Set debug port of child process.

If child process `debugMode` is `"none"` this option has no effect.<br />
The number `0` means debug port will be randomly assigned to an available port.

If you don't pass `debugPort` options, its value will be:

```js
0
```

### debugMode

> Force or prevent a debugging session of child process.

Possibles values:

- `"inspect"`: like passing `--inspect` to child process except port is set by `debugPort` option.
- `"inspect-brk"`: like passing `--inspect-brk` to child process except port is set by `debugPort` option.
- `"debug"`: like passing `--debug` to child process except port is set by `debugPort` option.
- `"debug-brk"`: like passing `--debug-brk` to child process except port is set by `debugPort` option.
- `"none"`: pass nothing related to debug to child process.
- `"inherit"`: `debugMode` value will be any debug option found into `process.execArgv`, otherwise it will be `"none"`.

If you don't pass `debugMode` options, its value will be:

```js
"inherit"
```

### debugModeInheritBreak

> Force or prevent `-brk` option on child process

This option has an effect only when `debugMode` option is `"inherit"`.<br />

`debugModeInheritBreak` controls if `debugMode` will inherit the `-brk` suffix.

If you don't pass `debugModeInheritBreak`, its value will be:

```js
true
```

### traceWarnings

> Pass `--trace-warnings` to child process or not.

If you don't pass `traceWarnings`, its value will be:

```js
true
```
