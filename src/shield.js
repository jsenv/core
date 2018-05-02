import { passed } from "@dmail/action"

export const shield = (fn, guard) => (...args) => {
  return passed(guard(...args)).then(() => {
    return fn(...args)
  })
}
