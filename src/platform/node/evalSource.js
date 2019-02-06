import { Script } from "vm"

export const evalSource = (code, filename) => {
  const script = new Script(code, { filename })
  return script.runInThisContext()
}
