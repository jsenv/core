const { makeProcessControllable } = require("./makeProcessControllable.cjs")

makeProcessControllable({
  evaluate: async (expressionString) => {
    // eslint-disable-next-line no-eval
    const namespace = await eval(`${expressionString}
    ${"//#"} sourceURL=__node-evaluation-script__.js`)
    const value = await namespace.default
    return value
  },
})
