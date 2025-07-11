import { signal } from "@preact/signals";

const roleCanLoginCountSignal = signal(0);
export const setRoleCanLoginCount = (count) => {
  roleCanLoginCountSignal.value = count;
};
export const useRoleCanLoginCount = () => {
  return roleCanLoginCountSignal.value;
};
const roleGroupCountSignal = signal(0);
export const useRoleGroupCount = () => {
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

const databaseCountSignal = signal(0);
export const setDatabaseCount = (count) => {
  databaseCountSignal.value = count;
};
export const useDatabaseCount = () => {
  return databaseCountSignal.value;
};
