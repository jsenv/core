export const inspectFunction = (
  value,
  { showFunctionBody, parenthesis, depth },
) => {
  let functionSource
  if (showFunctionBody) {
    functionSource = value.toString()
  } else {
    const isArrowFunction = value.prototype === undefined
    const head = isArrowFunction
      ? "() =>"
      : `function ${depth === 0 ? value.name : ""}()`
    functionSource = `${head} {/* hidden */}`
  }

  if (parenthesis) {
    return `(${functionSource})`
  }
  return functionSource
}
