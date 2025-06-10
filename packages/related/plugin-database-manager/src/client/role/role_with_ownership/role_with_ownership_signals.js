import { computed, signal } from "@preact/signals";
import { roleStore } from "../role_store.js";

const roleWithOwnershipCountSignal = signal(0);
export const setRoleWithOwnershipCount = (count) => {
  roleWithOwnershipCountSignal.value = count;
};
export const useRoleWithOwnershipCount = () => {
  return roleWithOwnershipCountSignal.value;
};

const rolWithOwnershipListSignal = computed(() => {
  const roles = roleStore.arraySignal.value;
  return roles.filter((role) => role.object_count > 0);
});
export const useRoleWithOwnershipList = () => {
  return rolWithOwnershipListSignal.value;
};
