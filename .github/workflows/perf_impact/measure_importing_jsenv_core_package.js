import { resourceUsage } from "process"

const beforeImportRessourceUsage = resourceUsage()

await import(`@jsenv/core`)

const afterImportRessourceUsage = resourceUsage()

export const userCPUTime =
  afterImportRessourceUsage.userCPUTime - beforeImportRessourceUsage.userCPUTime

export const systemCPUTime =
  afterImportRessourceUsage.systemCPUTime - beforeImportRessourceUsage.systemCPUTime

export const memorySpace = afterImportRessourceUsage.maxRSS - beforeImportRessourceUsage.maxRSS

export const fileSystemReadOperationCount =
  afterImportRessourceUsage.fsRead - beforeImportRessourceUsage.fsRead

export const fileSystemWriteOperationCount =
  afterImportRessourceUsage.fsWrite - beforeImportRessourceUsage.fsWrite
