import { writeFile } from "@jsenv/util"

export const generateCoverageJsonFile = async (coverage, coverageJsonFileUrl) => {
  await writeFile(coverageJsonFileUrl, JSON.stringify(coverage, null, "  "))
}
