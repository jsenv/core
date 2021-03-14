import classApplyDescriptorDestructureSet from "../classApplyDescriptorDestructureSet/classApplyDescriptorDestructureSet.js"
import classExtractFieldDescriptor from "../classExtractFieldDescriptor/classExtractFieldDescriptor.js"

export default function (receiver, privateMap) {
  var descriptor = classExtractFieldDescriptor(receiver, privateMap, "set")
  return classApplyDescriptorDestructureSet(receiver, descriptor)
}
