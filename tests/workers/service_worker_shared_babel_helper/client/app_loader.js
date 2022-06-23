import("./app.js")
const getResponse = () => {
  return [42]
}
const [answer] = getResponse()

console.log({
  ...{ answer },
})
window.resolveResultPromise({
  answer: 42,
})
