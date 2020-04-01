// eslint-disable-next-line consistent-return
export default (iter) => {
  if (typeof Symbol !== "undefined" && Symbol.iterator in Object(iter)) return Array.from(iter)
}
