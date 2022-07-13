# 27.4.0

- feature: use custom elements to render error in document
- feature: click on error overlay now open in editor

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
