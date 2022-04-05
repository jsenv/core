import undef from "../temporalUndefined/temporalUndefined.js"
import err from "../tdz/tdz.js"

export default function (val, name) {
  return val === undef ? err(name) : val
}
