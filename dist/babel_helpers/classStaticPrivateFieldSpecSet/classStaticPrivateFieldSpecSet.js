import classApplyDescriptorSet from "../classApplyDescriptorSet/classApplyDescriptorSet.js"
import classCheckPrivateStaticAccess from "../classCheckPrivateStaticAccess/classCheckPrivateStaticAccess.js"
import classCheckPrivateStaticFieldDescriptor from "../classCheckPrivateStaticFieldDescriptor/classCheckPrivateStaticFieldDescriptor.js"

export default function _classStaticPrivateFieldSpecSet(
  receiver,
  classConstructor,
  descriptor,
  value,
) {
  classCheckPrivateStaticAccess(receiver, classConstructor)
  classCheckPrivateStaticFieldDescriptor(descriptor, "set")
  classApplyDescriptorSet(receiver, descriptor, value)
  return value
}
