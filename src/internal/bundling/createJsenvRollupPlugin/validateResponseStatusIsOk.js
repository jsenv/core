export const validateResponseStatusIsOk = ({ status, url }) => {
  if (responseStatusIsOk(status)) {
    return { valid: true }
  }

  return {
    valid: false,
    message: `unexpected response status.
--- response status ---
${status}
--- expected status ---
200 to 299
--- url ---
${url}`,
  }
}

const responseStatusIsOk = (responseStatus) => responseStatus >= 200 && responseStatus < 300
