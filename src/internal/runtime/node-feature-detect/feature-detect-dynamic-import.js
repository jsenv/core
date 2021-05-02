const jsAsBase64 = Buffer.from("export default 42").toString("base64")
const moduleSource = `data:text/javascript;base64,${jsAsBase64}`

import(moduleSource)
