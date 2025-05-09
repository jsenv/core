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
export const appendRoles = (roles) => {
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
export const useRole = (roleName) => {
  const roles = roleListSignal.value;
  const role = roles.find((role) => role.rolname === roleName);
  return role;
};
export const updateRole = (roleName, props) => {
  const roles = roleListSignal.peek();
  const roleIndex = roles.findIndex(
    (roleCandidate) => roleCandidate.rolname === roleName,
  );
  if (roleIndex === -1) {
    roles.push(props);
    roleListSignal.value = [...roles];
  } else {
    const role = roles[roleIndex];
    roles[roleIndex] = { ...role, ...props };
    roleListSignal.value = [...roles];
  }
};
export const removeRole = (roleName) => {
  const roles = roleListSignal.peek();
  const rolesWithoutThisOne = [];
  for (const roleCandidate of roles) {
    if (roleCandidate.rolname !== roleName) {
      rolesWithoutThisOne.push(roleCandidate);
    }
  }
  if (rolesWithoutThisOne.length !== roles.length) {
    roleListSignal.value = rolesWithoutThisOne;
  }
};

export const currentRoleSignal = signal(null);
export const useCurrentRole = () => {
  return currentRoleSignal.value;
};
export const setCurrentRole = (value) => {
  currentRoleSignal.value = value;
  updateRole(value.rolname, value);
};
