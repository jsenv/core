import { PerformanceObserver } from "perf_hooks"

const perfObserver = new PerformanceObserver(
  (
    // https://nodejs.org/dist/latest-v16.x/docs/api/perf_hooks.html#perf_hooks_class_performanceobserverentrylist
    list,
  ) => {
    const perfEntries = list.getEntries()
    console.log(perfEntries)
  },
)
// perfObserver.observe()
perfObserver.observe({
  entryTypes: ["measure"],
})

import("./file.js")
