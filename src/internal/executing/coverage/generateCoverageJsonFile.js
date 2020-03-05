import { writeFile } from "@jsenv/util"

export const generateCoverageJsonFile = async (coverageMap, coverageJsonFileUrl) => {
  await writeFile(coverageJsonFileUrl, JSON.stringify(coverageMap, null, "  "))
}
