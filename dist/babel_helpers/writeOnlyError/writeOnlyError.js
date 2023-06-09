export default function (name) {
  // eslint-disable-next-line prefer-template
  throw new TypeError(name + " is write-only")
}
