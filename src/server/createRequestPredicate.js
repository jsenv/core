import { ressourceToPathname } from "../urlHelper.js"
import { regexpEscape } from "../stringHelper.js"

export const createRequestPredicate = ({ ressource = "*", method }) => {
  // 'a\\*c'.replace(/\\\*/g, 'ok')
  const ressourcePatternEscaped = regexpEscape(ressource)
  const ressourcePattern = ressourcePatternEscaped.replace(/\\\*/g, ".*?")
  const regexp = new RegExp(`^${ressourcePattern}$`)

  const matchRessource = (ressource) => {
    return regexp.test(ressource)
  }

  const lowserCaseMethod = method.toLowerCase()
  const matchMethod = (requestMethod) => {
    if (lowserCaseMethod === "*") {
      return true
    }
    return requestMethod.toLowerCase() === lowserCaseMethod
  }

  return (request) => {
    if (matchMethod(request.method) === false) {
      return false
    }
    if (matchRessource(ressourceToPathname(request.ressource)) === false) {
      return false
    }
    return true
  }
}
