// eslint-disable-next-line consistent-return
export default (iter) => {
  if (
    Symbol.iterator in Object(iter) ||
    Object.prototype.toString.call(iter) === "[object Arguments]"
  )
    return Array.from(iter)
}
