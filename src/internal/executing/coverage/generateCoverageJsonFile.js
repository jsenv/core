import { writeFile } from "@jsenv/filesystem"

export const generateCoverageJsonFile = async (coverage, coverageJsonFileUrl) => {
  await writeFile(coverageJsonFileUrl, JSON.stringify(coverage, null, "  "))
}
