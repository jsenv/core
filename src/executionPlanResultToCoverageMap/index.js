import { Collector, Reporter } from "istanbul"

export { coverageMapToAbsolute } from "./coverageMapToAbsolute.js"
export { executionPlanResultToCoverageMap } from "./executionPlanResultToCoverageMap.js"

export const coverageMapLog = (coverageMap) => {
  const collector = new Collector()
  collector.add(coverageMap)
  const reporter = new Reporter()
  reporter.add("text")
  reporter.write(collector, false, () => {})
}

export const coverageMapHTML = (coverageMap) => {
  const collector = new Collector()
  collector.add(coverageMap)
  const reporter = new Reporter()
  reporter.add("html")
  reporter.write(collector, false, () => {})
}
