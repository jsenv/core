export default function(name) {
  // eslint-disable-next-line prefer-template
  throw new Error(name + " is read-only")
}
