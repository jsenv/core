const childProcess = require("child_process")

childProcess.fork(`${__dirname}/main.es5.js`, {
  execArgv: [`--inspect-brk`],
})
