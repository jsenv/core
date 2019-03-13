import { Collector, Reporter } from "istanbul"

export const generateCoverageLog = (coverageMap) => {
  const collector = new Collector()
  collector.add(coverageMap)
  const reporter = new Reporter()
  reporter.add("text")
  reporter.write(collector, false, () => {})
}
