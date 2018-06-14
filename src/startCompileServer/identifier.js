import { writeSourceURL } from "./writeSourceInfo.js"

export const identifier = ({ code, ...rest }, options, context) => {
  return {
    code: writeSourceURL(code, context),
    ...rest,
  }
}
