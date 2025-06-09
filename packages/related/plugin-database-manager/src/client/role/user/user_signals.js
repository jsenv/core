import { computed, signal } from "@preact/signals";
import { roleStore } from "../role_store.js";

const userCountSignal = signal(0);
export const setUserCount = (count) => {
  userCountSignal.value = count;
};
export const useUserCount = () => {
  return userCountSignal.value;
};

export const userListSignal = computed(() => {
  const roleList = roleStore.arraySignal.value;
  return roleList.filter((role) => role.rolcanlogin);
});
export const useUserList = () => {
  return userListSignal.value;
};
