export default (obj) => {
  if (obj === null) throw new TypeError("Cannot destructure undefined")
}
