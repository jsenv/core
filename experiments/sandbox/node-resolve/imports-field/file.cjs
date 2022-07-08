// unfortunately https://www.npmjs.com/package/eslint-import-resolver-node
// does not seems to be compatible with package imports field
// eslint-disable-next-line import/no-unresolved
const { dev } = require("#env")

console.log(dev)
