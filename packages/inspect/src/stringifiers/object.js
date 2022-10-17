import {
  preNewLineAndIndentation,
  wrapNewLineAndIndentation,
} from "../utils.js"
import { inspectConstructor } from "./constructor.js"

export const inspectObject = (
  value,
  {
    nestedInspect,
    seen = [],
    depth,
    indentUsingTab,
    indentSize,
    objectConstructor,
    parenthesis,
    useNew,
  },
) => {
  if (seen.indexOf(value) > -1) return "Symbol.for('circular')"

  seen.push(value)

  const propertySourceArray = []
  Object.getOwnPropertyNames(value).forEach((propertyName) => {
    const propertyNameAsNumber = parseInt(propertyName, 10)
    const propertyNameSource = nestedInspect(
      Number.isInteger(propertyNameAsNumber)
        ? propertyNameAsNumber
        : propertyName,
    )
    propertySourceArray.push({
      nameOrSymbolSource: propertyNameSource,
      valueSource: nestedInspect(value[propertyName], { seen }),
    })
  })
  Object.getOwnPropertySymbols(value).forEach((symbol) => {
    propertySourceArray.push({
      nameOrSymbolSource: `[${nestedInspect(symbol)}]`,
      valueSource: nestedInspect(value[symbol], { seen }),
    })
  })

  let propertiesSource = ""
  propertySourceArray.forEach(({ nameOrSymbolSource, valueSource }, index) => {
    if (index === 0) {
      propertiesSource += `${nameOrSymbolSource}: ${valueSource}`
    } else {
      propertiesSource += `,${preNewLineAndIndentation(
        `${nameOrSymbolSource}: ${valueSource}`,
        {
          depth,
          indentUsingTab,
          indentSize,
        },
      )}`
    }
  })

  let objectSource
  if (propertiesSource.length) {
    objectSource = `${wrapNewLineAndIndentation(propertiesSource, {
      depth,
      indentUsingTab,
      indentSize,
    })}`
  } else {
    objectSource = ""
  }

  if (objectConstructor) {
    objectSource = `Object({${objectSource}})`
  } else {
    objectSource = `{${objectSource}}`
  }

  return inspectConstructor(objectSource, { parenthesis, useNew })
}
