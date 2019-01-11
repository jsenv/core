import { registerUngaranteedProcessTeardown } from "./registerUngaranteedProcessTeardown.js"

registerUngaranteedProcessTeardown((reason) => {
  console.log(reason)
})
