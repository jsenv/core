export default function _classNameTDZError(name) {
  // eslint-disable-next-line prefer-template
  throw new ReferenceError("Class " + name + "cannot be referenced in computed property keys.");
}