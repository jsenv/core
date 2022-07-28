# 27.7.0

- use websocket to communicate between jsenv dev server and clients
- update playwright

# 27.6.1

- code frame show source code frame also in firefox/webkit for runtime errors
- use [sourcemap-js](https://github.com/7rulnik/source-map-js) instead of [source-map](https://github.com/mozilla/source-map)

# 27.6.0

- add code frame in error overlay for fetch/parse/execute errors
- generate error overlay screenshots for firefox and webkit too
- fix cannot fetch file: on sourcemap in Firefox and webkit

# 27.5.3

- use a more resilient logic to choose between browser and server error

# 27.5.2

- display correct url:line:column for inline scripts
- use snapshot to test dev server errors + screenshots
- add code frame for runtime errors and syntax errors (error reported by browser)

# 27.5.1

- add host to startDevServer

# 27.5.0

- add htmlSupervisor.errorOverlay parameters
- add "reported by browser/server ..." at the bottom of error overlay
- close error overlay on hot reload
- prevent server errors from displaying overlay on unrelated pages or once execution is done
- fix hot reload for script using `hot-accept` attribute
- handle type="text/jsx" and type="module/jsx" on script tags (same for ts)
- add warnings when plugin contains unexpected properties
- fix server host resolution for node 18+
- add htmlSupervisor.openInEditor
- css import assertion + hot reload works in firefox
- fix infinite reloading when code using import assertion is executed at the same time in firefox and chrome
- rename explorerGroups into explorer.groups (gives ability to disable explorer)
- allow any preact/react version in peerDependencies
- update dependencies

# 27.4.0

- feature: click on error overlay now open in editor
- feature: improve error trace for inline scripts and syntax errors
- fix: use custom elements to render error overlay (prevent conflicts)
- fix: ignore "file:///" when used as second argument in new URL

# 27.3.4

- fix: invalidate HTML inline contents when it changes
- fix: remove redundant abort error from test plan logs

# 27.3.3

- coverageMethodForNodeJs default value becomes "Profiler"

# 27.3.2

- Use "localhost" only if their is a mapping to 127.0.0.1 on the OS
- Consume stdout before terminating node worker thread

# 27.3.0

- Update node to 18.5.0 to get https://github.com/nodejs/node/commit/0fc1cf478f7a448241791f5cf2c25f2d45bfd5b5

# 27.2.0

- Rename nodeProcess to nodeChildProcess
- Add nodeWorkerThread
- Rename executeTestPlan.coverage to executeTestPlan.coverageEnabled
- When coverage is enabled, process.env.NODE_V8_COVERAGE must be set otherwise a warning is logged

# 27.1.0

- Add console repartition in logs (see https://github.com/jsenv/jsenv-core/issues/224)

# 27.0.3

- Disable sourcemap for preact-refresh and react-refresh

# 27.0.0

Add CHANGELOG.md
