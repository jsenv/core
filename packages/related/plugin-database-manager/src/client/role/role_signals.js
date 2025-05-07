import { signal } from "@preact/signals";

// export const currentRoleSignal = signal(null);
export const roleColumnsSignal = signal([]);
export const useRoleColumns = () => {
  return roleColumnsSignal.value;
};
export const setRoleColumns = (value) => {
  roleColumnsSignal.value = value;
};

export const roleListSignal = signal([]);
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
