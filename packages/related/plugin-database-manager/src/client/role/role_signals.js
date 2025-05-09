import { signal } from "@preact/signals";
import { arraySignalStore } from "@jsenv/sigi";

export const roleColumnsSignal = signal([]);
export const useRoleColumns = () => {
  return roleColumnsSignal.value;
};
export const setRoleColumns = (value) => {
  roleColumnsSignal.value = value;
};

export const roleStore = arraySignalStore([], "rolname");
export const useRoleList = () => {
  return roleStore.arraySignal.value;
};
export const useRole = (roleName) => {
  return roleStore.getByUniquePropertyName(roleName);
};
const [currentRoleSignal, setCurrentRole] = roleStore.itemSignal();
export const useCurrentRole = () => {
  return currentRoleSignal.value;
};
export { setCurrentRole };
