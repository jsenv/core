import { computed, signal } from "@preact/signals";
import { roleStore } from "../role_store.js";

const roleGroupCountSignal = signal(0);
export const setRoleGroupCount = (count) => {
  roleGroupCountSignal.value = count;
};
export const useRoleGroupCount = () => {
  return roleGroupCountSignal.value;
};

export const roleGroupListSignal = computed(() => {
  const roleList = roleStore.arraySignal.value;
  return roleList.filter((role) => !role.rolcanlogin);
});
export const useRoleGroupList = () => {
  return roleGroupListSignal.value;
};
