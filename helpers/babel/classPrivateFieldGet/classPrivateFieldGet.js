import classApplyDescriptorGet from "../classApplyDescriptorGet/classApplyDescriptorGet.js"
import classExtractFieldDescriptor from "../classExtractFieldDescriptor/classExtractFieldDescriptor.js"

export default function (receiver, privateMap) {
  var descriptor = classExtractFieldDescriptor(receiver, privateMap, "get")
  return classApplyDescriptorGet(receiver, descriptor)
}
