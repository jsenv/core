import { Script } from "node:vm"

export const evalSource = (code, filePath) => {
  const script = new Script(code, { filename: filePath })
  return script.runInThisContext()
}
