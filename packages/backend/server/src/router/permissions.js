export const permissionsSatisfy = (permissionsSet, permissionsRequired) => {
  for (const permission of permissionsRequired) {
    if (!permissionsSet.has(permission)) {
      return false;
    }
  }
  return true;
};

// Both helpers share one cursor over the "grantPermissions" hooks so that each
// plugin runs at most once per request: hasPermissions stops as soon as the
// required permissions are all granted, getAllPermissions drains the plugins
// left.
export const createPermissionHelpers = (serverPluginsController, request) => {
  const permissionsSet = new Set();
  const nextPermissionsHook = serverPluginsController.createAsyncHookIterator(
    "grantPermissions",
    request,
  );
  const drainPermissionsUntil = async (permissionsRequired) => {
    for (;;) {
      if (
        permissionsRequired !== undefined &&
        permissionsSatisfy(permissionsSet, permissionsRequired)
      ) {
        return true;
      }
      const { done, value } = await nextPermissionsHook();
      if (done) {
        break;
      }
      if (Array.isArray(value)) {
        for (const permission of value) {
          permissionsSet.add(permission);
        }
      }
    }
    return false;
  };

  const getAllPermissions = async () => {
    await drainPermissionsUntil(undefined);
    return permissionsSet;
  };
  const hasPermissions = async (permissionsRequired) => {
    if (permissionsRequired.length === 0) {
      return true;
    }
    return drainPermissionsUntil(permissionsRequired);
  };
  return { getAllPermissions, hasPermissions };
};
