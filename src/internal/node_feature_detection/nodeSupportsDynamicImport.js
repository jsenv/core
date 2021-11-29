import { memoize } from "@jsenv/filesystem"

export const nodeSupportsDynamicImport = memoize(async () => {
  return true
})
