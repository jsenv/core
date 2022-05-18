import { init, parse } from "es-module-lexer"

// fast detection of import assertions
// see https://github.com/guybedford/es-module-lexer#usage
// ideally we would use solely es-module-lexer and resort to babel
// for the things out of the scope of es-module-lexer
export const detectJsModuleImports = async (js) => {
  await init
  try {
    const [imports] = parse(js)
    return imports
  } catch (e) {
    // this function is a bit special, when it throws we ignore the syntax error
    // because it is used to detect imports and decide if we'll parse
    // when it returns null, it means "I don't know", in that case code will go ahead and parse
    return null
  }
}
