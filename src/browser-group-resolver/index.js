import { detect } from "./browserDetect/index.js"
import { browserToCompileId } from "./browserToCompileId.js"

export const resolveGroup = ({ groupMap }) => {
  const browser = detect()
  return browserToCompileId(browser, groupMap)
}
