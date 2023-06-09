import classApplyDescriptorSet from "../classApplyDescriptorSet/classApplyDescriptorSet.js"
import classExtractFieldDescriptor from "../classExtractFieldDescriptor/classExtractFieldDescriptor.js"

export default function (receiver, privateMap, value) {
  var descriptor = classExtractFieldDescriptor(receiver, privateMap, "set")
  classApplyDescriptorSet(receiver, descriptor, value)
  return value
}
