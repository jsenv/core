// eslint-disable-next-line import/no-unresolved
import { DEV } from "#env"

export const greet = () => {
  return DEV ? "Welcome dev" : "Welcome"
}
