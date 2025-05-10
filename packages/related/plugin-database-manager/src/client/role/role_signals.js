import { signal } from "@preact/signals";
import { arraySignalStore } from "@jsenv/sigi";

export const roleColumnsSignal = signal([]);
export const useRoleColumns = () => {
  return roleColumnsSignal.value;
};
export const setRoleColumns = (value) => {
  roleColumnsSignal.value = value;
};

export const roleStore = arraySignalStore([], "oid");
export const useRoleList = () => {
  return roleStore.arraySignal.value;
};
export const useRole = (roleName) => {
  return roleStore.select("rolname", roleName);
};
const currentRoleSignal = signal(null);
export const useCurrentRole = () => {
  const currentRole = currentRoleSignal.value;
  return currentRole ? roleStore.select("oid", currentRole.oid) : null;
};
export const setCurrentRole = (value) => {
  currentRoleSignal.value = value;
  roleStore.upsert(value);
};
