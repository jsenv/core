import { composeMapToCompose } from "../objectHelper.js"
import { headersCompose } from "./headers.js"

const responseComposeMap = {
  headers: headersCompose,
}

export const responseCompose = composeMapToCompose(responseComposeMap)
