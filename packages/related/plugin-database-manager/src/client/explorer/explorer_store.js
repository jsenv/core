import { resource } from "@jsenv/navi";
import { signal } from "@preact/signals";
import { errorFromResponse } from "../error_from_response.js";

const roleCanLoginCountSignal = signal(0);
export const setRoleCanLoginCount = (count) => {
  roleCanLoginCountSignal.value = count;
};
export const useRoleCanLoginCount = () => {
  return roleCanLoginCountSignal.value;
};
const roleGroupCountSignal = signal(0);
export const useRoleGroupCountSignal = () => {
  return roleGroupCountSignal.value;
};
export const setRoleGroupCount = (count) => {
  roleGroupCountSignal.value = count;
};
const roleWithOwnershipCountSignal = signal(0);
export const useRoleWithOwnershipCountSignal = () => {
  return roleWithOwnershipCountSignal.value;
};
export const setRoleWithOwnershipCount = (count) => {
  roleWithOwnershipCountSignal.value = count;
};

export const setRoleCounts = ({
  canLoginCount,
  groupCount,
  withOwnershipCount,
}) => {
  setRoleCanLoginCount(canLoginCount);
  setRoleGroupCount(groupCount);
  setRoleWithOwnershipCount(withOwnershipCount);
};

export const EXPLORER = resource("explorer", {
  GET: async () => {
    const getRoleUrl = new URL(`${window.DB_MANAGER_CONFIG.apiUrl}/explorer`);
    const response = await fetch(getRoleUrl, { signal });
    if (!response.ok) {
      throw await errorFromResponse(response, "Failed to get role");
    }
    const { data } = await response.json();
    const { roleCounts } = data;
    setRoleCounts(roleCounts);
    return null;
  },
});
EXPLORER.GET.load();
