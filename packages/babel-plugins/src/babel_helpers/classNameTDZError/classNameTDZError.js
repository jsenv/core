export default function _classNameTDZError(name) {
  // eslint-disable-next-line prefer-template
  throw new Error("Class " + name + "cannot be referenced in computed property keys.")
}
