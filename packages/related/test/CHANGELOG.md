# 1.7.0

- Implement github annotations, enabled by default when runned inside GitHub workflow

# 1.6.5

- Use node `crypto.randomUUID()` instead of `@paralleldrive/cuid2` because later is not installed by NPM for some reason
- Use `--import=module` instead of `--experimental-loader=module` because the later is deprecated and does not work with worker threads after node v20+

# 1.6.0

- Add webServer.command

# 1.2.0

- Replace dependency to "@jsenv/core" with "@jsenv/plugin-supervisor"

# 1.1.3

- Restore semicolons, update a warning message

# 1.1.0

- Disable firefox executions on windows by default as they are flaky

# 1.0.4

- Restore logMergeForCompletedExecutions default value to false

# 1.0.3

- Rename some params for consistency

# 1.0.2

- Restore headful browser when keepRunning is enabled
