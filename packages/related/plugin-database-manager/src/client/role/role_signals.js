import { signal } from "@preact/signals";

export const roleColumnsSignal = signal([]);
export const useRoleColumns = () => {
  return roleColumnsSignal.value;
};
export const setRoleColumns = (value) => {
  roleColumnsSignal.value = value;
};

export const roleListSignal = signal([]);
export const useRoleList = () => {
  return roleListSignal.value;
};
export const upsertRoles = (roles) => {
  const existingRoles = roleListSignal.peek();
  if (existingRoles.length === 0) {
    roleListSignal.value = roles;
    return;
  }
  const rolesUpdated = [];
  const existingRoleMap = new Map();
  for (const existingRole of existingRoles) {
    rolesUpdated.push(existingRole);
    existingRoleMap.set(existingRole.rolname, existingRole);
  }
  for (const role of roles) {
    const existingRole = existingRoleMap.get(role.rolname);
    if (existingRole) {
      Object.assign(existingRole, role);
    } else {
      rolesUpdated.push(role);
    }
  }
  roleListSignal.value = rolesUpdated;
};
export const upsertRole = (roleName, role) => {
  const roles = roleListSignal.peek();
  let found = false;
  const rolesUpdated = [];
  for (const existingRole of roles) {
    if (existingRole.rolname === roleName) {
      found = true;
      Object.assign(existingRole, role);
      rolesUpdated.push(existingRole);
    } else {
      rolesUpdated.push(existingRole);
    }
  }
  if (!found) {
    rolesUpdated.push(role);
  }
  roleListSignal.value = rolesUpdated;
};
export const useRole = (roleName) => {
  const roles = roleListSignal.value;
  const role = roles.find((role) => role.rolname === roleName);
  return role;
};
export const removeRole = (roleName) => {
  const roles = roleListSignal.peek();
  const rolesWithoutThisOne = [];
  let found = false;
  for (const roleCandidate of roles) {
    if (roleCandidate.rolname === roleName) {
      found = true;
    } else {
      rolesWithoutThisOne.push(roleCandidate);
    }
  }
  if (found) {
    roleListSignal.value = rolesWithoutThisOne;
  }
};

export const currentRoleSignal = signal(null);
export const useCurrentRole = () => {
  return currentRoleSignal.value;
};
export const setCurrentRole = (value) => {
  currentRoleSignal.value = value;
  upsertRole(value.rolname, value);
};
