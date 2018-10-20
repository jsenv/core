import { compileToCompileFile as defaultCompileToCompileFile } from "../compileToCompileFile/index.js"
import { locate } from "./locate.js"

export const compileToCompileFile = (compile, { root, into }) => {
  return defaultCompileToCompileFile(compile, { root, into, locate })
}
