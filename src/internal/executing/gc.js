import v8 from "node:v8"
import { runInNewContext } from "node:vm"

export const ensureGlobalGc = () => {
  if (!global.gc) {
    v8.setFlagsFromString("--expose_gc")
    global.gc = runInNewContext("gc")
  }
}
