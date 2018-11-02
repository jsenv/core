import { compileToCompileFile } from "../compileToCompileFile/index.js"
import { locate } from "./locate.js"

export const jsCompileToCompileFile = (compile, { localRoot, compileInto }) => {
  return compileToCompileFile(compile, { localRoot, compileInto, locate })
}
