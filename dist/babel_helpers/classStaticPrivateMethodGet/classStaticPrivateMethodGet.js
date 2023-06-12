import classCheckPrivateStaticAccess from "../classCheckPrivateStaticAccess/classCheckPrivateStaticAccess.js"

export default function _classStaticPrivateMethodGet(receiver, classConstructor, method) {
  classCheckPrivateStaticAccess(receiver, classConstructor)
  return method
}
