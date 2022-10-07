# 29.1.13

- Do not send eTag when a plugin set cache-control:no-store

# 29.1.12

- Fix a bug when node imports subpath resolution is involved

# 29.1.11

- Gracefully handle syntax error occuring inside "as_js_classic_library"
- Better handling of 404 inside "as_js_classic_library"

# 29.1.10

- Prevent duplicate files when file referenced by new URL() + dynamic import

# 29.1.9

- Fix new URL() update during js classic conversion
- Properly handle unicode character during file url matching and logging

# 29.1.8

- Fix dev server crashing when file is renamed
- Fix s.js.map not found during dev
- Ensure new URL() on js is updated too during js classic conversion
- Preserve resource hints targeting js imported dynamically
- Prefer injecting script after resource hints when possible

# 29.1.7

- update playwright and other deps

# 29.1.5

- fix parse error crashing dev server
- fix node_esm applied for script type module in html

# 29.1.2

- fix preact-debug injection
- fix sourcemap resolution inside js modules

# 29.1.1

- allow plugins to set error.asResponse to control server response for that error

# 29.1.0

- log only one url for dev server when hostname is passed
- urlResolution now applies on url type not reference type (js urls have node esm by default too)

# 29.0.1

- update @jsenv/server to give more info on ERR_INVALID_CHAR

# 29.0.0

- **breaking change**: introduce urlResolution
  - replace nodeEsmResolution
  - new way to disable node esm resolution visible here https://github.com/jsenv/jsenv-core/pull/309/files#diff-f1264f171aeba6139f3338d6682b28e466ef796ab84760d608ed8c69b3d80073R34-R36
- **breaking change**: rename fileSystemMagicResolution in fileSystemMagicRedirection
- fix explorer.html not served anymore after sarting dev server

# 28.6.0

- add clientMainFileUrl to startDevServer, can be used to send a custom
  html file instead of jsenv explorer.html
- fix dev server crashing on some parsing errors
- explorer.html is now cooked (goes through plugins pipe) like everything else

# 28.5.1

- fix error when css contains @import

# 28.5.0

- s.js is now injected inline in html

# 28.4.3

- prevent error from supervisor when error.stack is undefined

# 28.4.2

- prevent facade file during build by default, add `bundling.js_modules.strictExports` to configure that

# 28.4.1

- fix 28.4.0 not updating `@jsenv/ast`

# 28.4.0

- handle `window.location` in new URL() second arg

# 28.3.6

- update dependencies

# 28.3.5

- fix hotreload on preact/react when dev server is not in https (http)
- reload and invalidate once for import assertions

# 28.3.4

- fix autoreload when inline script changes in an html file using search params

# 28.3.3

- updating files update all urls using search params too

# 28.3.2

- ensure inline script are properly updated on reload
- fix a warning logger by server on 304
- fix a bug keeping sourcemap when marked as broken by preact/react refresh

# 28.3.1

- prevent error when sourcemap is returned by a plugin for an html file
- ensure content-length is overrided when plugin set custom response headers

# 28.3.0

- Export "replacePlaceHolders"

# 28.2.3

- Fix dist/s.js sourcemap comment

# 28.2.2

- Fix as_js_classic_library build error when babel helpers are used

# 28.2.1

- fix build using "?as_js_classic_library" in entry points
- auto update "create-jsenv" when "@jsenv/core" version is updated

# 28.2.0

- add "?as_js_classic_library" to consume js modules with a regular script tag
- it is now possible to use the following query params in source files:
  - "?as_js_classic"
  - "?as_json_module"
  - "?as_css_module"
  - "?as_text_module"
  - "?as_js_classic_library"
- Create a relationship with source file when a file is referenced with a query params from the list above (means hot reload and cache invalidation work as expected)
- preserve preload links when css becomes js
- update @jsenv/log to add logger.level
- improve build debug logs
- auto removal of preload link is now a "info" log instead of "warning" when it happens because file is bundled
- use same transpilation levels between main thread and workers in case some code is shared
- fix sourcemap source ENOENT on chrome
- reference.searchParams is now available during "redirectUrl" hook
- rework "as js classic" set of plugins to split how and when the query params are handled and the conversion is done

# 28.1.3

- fix error handling when runtine.run throw

# 28.1.2

- update how script execution is awaited by document supervisor

# 28.1.1

- fix script execution order in html

# 28.1.0

- htmlSupervisor renamed supervisor
- allow multiple errors during execution
  - update how error are logged during tests
- display error overlay on unhandled rejection
- add logRefresh to executeTestPlan
- add more stories in dev errors
- update @jsenv/assert output
- fix worker type module on firefox during dev
- fix data url handling during dev
- fix collectFiles in @jsenv/filesystem when path contains special chars
- stop generating coverage for this repository
  (I am not using this anymore it's a waste of ressources to compute it)

# 28.0.2

- prefer "ws.js" over "wrapper.js" when generating build files

# 28.0.1

- prefer "resource" over "ressource" in names

# 28.0.0

- tests now executed on the dev server
  - dev server must be started before executing tests
  - add new public export: "pingServer"
  - update test scripts in jsenv demos
- rename "host" into "hostname" for startDevServer

# 27.8.1

- fix websocket connection on https

# 27.8.0

- update plugin.appliesDuring and context.scenarios
  - when appliesDuring is "dev" plugin applies during dev+test
  - when appliesDuring is {dev: true, test: false} plugins applies only during dev

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
