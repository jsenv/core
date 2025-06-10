import { computed, signal } from "@preact/signals";
import { roleStore } from "../role_store.js";

const roleCanLoginCountSignal = signal(0);
export const setRoleCanLoginCount = (count) => {
  roleCanLoginCountSignal.value = count;
};
export const useRoleCanLoginCount = () => {
  return roleCanLoginCountSignal.value;
};

export const roleCanLoginListSignal = computed(() => {
  const roleList = roleStore.arraySignal.value;
  return roleList.filter((role) => role.rolcanlogin);
});
export const useRoleCanLoginList = () => {
  return roleCanLoginListSignal.value;
};
