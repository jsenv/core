// https://github.com/Marak/colors.js/blob/b63ef88e521b42920a9e908848de340b31e68c9d/lib/styles.js#L29

const close = "\x1b[0m"
const red = "\x1b[31m"
const green = "\x1b[32m"
const yellow = "\x1b[33m"
// const blue = "\x1b[34m"
const magenta = "\x1b[35m"
const cyan = "\x1b[36m"
// const white = "\x1b[37m"

export const colorizeResponseStatus = (status) => {
  const statusType = statusToType(status)

  if (statusType === "information") return `${cyan}${status}${close}`
  if (statusType === "success") return `${green}${status}${close}`
  if (statusType === "redirection") return `${magenta}${status}${close}`
  if (statusType === "client-error") return `${yellow}${status}${close}`
  if (statusType === "server-error") return `${red}${status}${close}`
  return status
}

// https://developer.mozilla.org/en-US/docs/Web/HTTP/Status
const statusToType = (status) => {
  if (statusIsInformation(status)) return "information"
  if (statusIsSuccess(status)) return "success"
  if (statusIsRedirection(status)) return "redirection"
  if (statusIsClientError(status)) return "client-error"
  if (statusIsServerError(status)) return "server-error"
  return "unknown"
}

const statusIsInformation = (status) => status >= 100 && status < 200

const statusIsSuccess = (status) => status >= 200 && status < 300

const statusIsRedirection = (status) => status >= 300 && status < 400

const statusIsClientError = (status) => status >= 400 && status < 500

const statusIsServerError = (status) => status >= 500 && status < 600
