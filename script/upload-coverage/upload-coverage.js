const codecov = require("codecov")
const { projectFolder } = require("../../jsenv.config.js")

const coverageFile = `${projectFolder}/coverage/coverage-final.json`
const readEnvFileCodecovToken = () => {
  // eslint-disable-next-line import/no-unresolved
  return require("../../env.json").CODECOV_TOKEN
}

;(async () => {
  const upload = codecov.handleInput.upload
  const token =
    "CODECOV_TOKEN" in process.env ? process.env.CODECOV_TOKEN : readEnvFileCodecovToken()

  return new Promise((resolve, reject) => {
    // https://github.com/codecov/codecov-node/blob/023d204c671bc7d66b72261d2da07f2b72da2669/lib/codecov.js#L238
    upload(
      {
        options: {
          token,
          file: coverageFile,
        },
      },
      resolve,
      reject,
    )
  })
})()
