import { Script } from "vm"

export const evalSource = (code, pathname) => {
  const script = new Script(code, { filename: pathname })
  return script.runInThisContext()
}
