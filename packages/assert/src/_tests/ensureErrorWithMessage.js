export const ensureErrorWithMessage = (value, message) => {
  if (value.name !== "Error") {
    throw new Error(`error expected, got ${value}`)
  }
  if (value.message !== message) {
    throw new Error(`unequal error message.
--- message ---
${value.message}
--- expected message ---
${message}`)
  }
}
