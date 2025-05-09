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
export const currentRoleSignal = roleStore.currentItemSignal;
export const useCurrentRole = () => {
  return roleStore.currentItemSignal.value;
};
export const setCurrentRole = (value) => {
  roleStore.setCurrentItem(value);
};
