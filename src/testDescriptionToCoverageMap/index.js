import istanbul from "istanbul"

export const coverageMapLog = (coverageMap) => {
  const collector = new istanbul.Collector()
  collector.add(coverageMap)
  const reporter = new istanbul.Reporter()
  reporter.add("text")
  reporter.write(collector, false, () => {})
}

export const coverageMapHTML = (coverageMap) => {
  const collector = new istanbul.Collector()
  collector.add(coverageMap)
  const reporter = new istanbul.Reporter()
  reporter.add("html")
  reporter.write(collector, false, () => {})
}

export { testDescriptionToCoverageMap } from "./testDescriptionToCoverageMap.js"
