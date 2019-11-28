export const stackToString = (stack, { error, indent }) => {
  const name = error.name || "Error"
  const message = error.message || ""
  const stackString = stack.map((callSite) => `\n${indent}at ${callSite}`).join("")

  return `${name}: ${message}${stackString}`
}
