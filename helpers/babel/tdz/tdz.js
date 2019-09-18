export default function(name) {
  // eslint-disable-next-line prefer-template
  throw new ReferenceError(name + " is not defined - temporal dead zone")
}
