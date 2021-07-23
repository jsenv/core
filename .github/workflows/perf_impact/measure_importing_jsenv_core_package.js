import { performance } from "perf_hooks"

performance.mark("import_start")
await import(`@jsenv/core`)
performance.measure("import @jsenv/core", "import_start")
