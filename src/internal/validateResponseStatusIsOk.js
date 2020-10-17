export const validateResponseStatusIsOk = ({ status, url }, importer) => {
  if (status === 404) {
    return {
      valid: false,
      message: `Error: got 404 on url.
--- url ---
${url}
--- imported by ---
${importer}`,
    }
  }

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
${importer}`,
  }
}

const responseStatusIsOk = (responseStatus) => responseStatus >= 200 && responseStatus < 300
