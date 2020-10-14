export const validateResponseStatusIsOk = ({ status, url }, importerUrl) => {
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
${url}
--- imported by ---
${importerUrl}`,
  }
}

const responseStatusIsOk = (responseStatus) => responseStatus >= 200 && responseStatus < 300
