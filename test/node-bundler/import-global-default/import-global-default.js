import globalThis from "global"

export default (globalThis === global ? 42 : 40)
