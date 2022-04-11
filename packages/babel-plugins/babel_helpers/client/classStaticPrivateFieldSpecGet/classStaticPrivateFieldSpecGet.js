import classApplyDescriptorGet from "../classApplyDescriptorGet/classApplyDescriptorGet.js"
import classCheckPrivateStaticAccess from "../classCheckPrivateStaticAccess/classCheckPrivateStaticAccess.js"
import classCheckPrivateStaticFieldDescriptor from "../classCheckPrivateStaticFieldDescriptor/classCheckPrivateStaticFieldDescriptor.js"

export default function _classStaticPrivateFieldSpecGet(receiver, classConstructor, descriptor) {
  classCheckPrivateStaticAccess(receiver, classConstructor)
  classCheckPrivateStaticFieldDescriptor(descriptor, "get")
  return classApplyDescriptorGet(receiver, descriptor)
}
