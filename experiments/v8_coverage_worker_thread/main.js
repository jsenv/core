// Run this with
// NODE_V8_COVERAGE=experiments/v8_coverage_worker_thread/coverage/ node experiments/v8_coverage_worker_thread/main.js

import { Worker } from "node:worker_threads"

// eslint-disable-next-line no-new
new Worker(new URL("./worker.js", import.meta.url))
