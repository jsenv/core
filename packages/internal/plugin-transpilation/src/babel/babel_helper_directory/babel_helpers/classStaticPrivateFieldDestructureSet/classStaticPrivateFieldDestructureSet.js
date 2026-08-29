import classApplyDescriptorDestructureSet from "../classApplyDescriptorDestructureSet/classApplyDescriptorDestructureSet.js";
import assertClassBrand from "../assertClassBrand/assertClassBrand.js";
import classCheckPrivateStaticFieldDescriptor from "../classCheckPrivateStaticFieldDescriptor/classCheckPrivateStaticFieldDescriptor.js";

/* eslint-disable */
export default function _classStaticPrivateFieldDestructureSet(receiver, classConstructor, descriptor) {
  assertClassBrand(classConstructor, receiver);
  classCheckPrivateStaticFieldDescriptor(descriptor, "set");
  return classApplyDescriptorDestructureSet(receiver, descriptor);
}
