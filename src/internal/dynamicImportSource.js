// ZXhwb3J0IGRlZmF1bHQgNDI= is Buffer.from("export default 42").toString("base64")

(async () => {
  const moduleSource = "data:text/javascript;base64,ZXhwb3J0IGRlZmF1bHQgNDI="
  try {
    const namespace = await import(moduleSource)
    return namespace.default === 42
  }
  catch(e) {
    return false
  }
})()