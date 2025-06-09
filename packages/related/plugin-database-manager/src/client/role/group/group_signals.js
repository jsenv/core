import { computed, signal } from "@preact/signals";
import { roleStore } from "../role_store.js";

const groupCountSignal = signal(0);
export const setGroupCount = (count) => {
  groupCountSignal.value = count;
};
export const useGroupCount = () => {
  return groupCountSignal.value;
};

export const groupListSignal = computed(() => {
  const roleList = roleStore.arraySignal.value;
  return roleList.filter((role) => !role.rolcanlogin);
});
export const useGroupList = () => {
  return groupListSignal.value;
};
