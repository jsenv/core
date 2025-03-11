async function AAA() {
  return "a"
}
async function BBB() {
  return "b"
}

window.resolveResultPromise({
  a: await AAA(),
  b: await BBB(),
})
