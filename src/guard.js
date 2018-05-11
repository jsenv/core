import { passed } from "@dmail/action"

export const guard = (fn, shield) => (...args) => {
  const shieldAction = passed(shield(...args))

  if (shieldAction.isPassed()) {
    return fn(...args)
  }
  if (shieldAction.isFailed()) {
    return undefined
  }
  throw new Error("guard expect shield to pass/fail synchronously")
}

export const guardAsync = (fn, shield) => (...args) => {
  return passed(shield(...args)).then(() => fn(...args))
}
