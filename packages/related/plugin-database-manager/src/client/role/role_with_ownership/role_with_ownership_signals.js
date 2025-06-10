import { computed } from "@preact/signals";
import { roleStore } from "../role_store.js";

const rolWithOwnershipListSignal = computed(() => {
  const roles = roleStore.arraySignal.value;
  return roles.filter((role) => role.object_count > 0);
});
export const useRoleWithOwnershipList = () => {
  return rolWithOwnershipListSignal.value;
};
