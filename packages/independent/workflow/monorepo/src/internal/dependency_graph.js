export const buildDependencyGraph = (workspacePackages) => {
  const dependencyGraph = {};
  Object.keys(workspacePackages).forEach((packageName) => {
    dependencyGraph[packageName] = {
      dependencies: [],
    };
  });
  const findDependency = (packageName, dependencyName) => {
    const trace = [];
    const visit = (name) => {
      if (name === dependencyName) return true;
      trace.push(name);
      return dependencyGraph[name].dependencies.some((name) => visit(name));
    };
    const found = dependencyGraph[packageName].dependencies.some((name) => {
      return visit(name);
    });
    return found ? trace : null;
  };
  const markPackageAsDependentOf = (packageName, dependencyName) => {
    const dependencyTrace = findDependency(dependencyName, packageName);
    if (dependencyTrace) {
      throw new Error(
        `Circular dependency between ${packageName} and ${dependencyName}`,
      );
    }
    dependencyGraph[packageName].dependencies.push(dependencyName);
  };
  Object.keys(workspacePackages).forEach((packageName) => {
    const workspacePackage = workspacePackages[packageName];
    const { packageObject } = workspacePackage;
    const { dependencies = {} } = packageObject;
    Object.keys(dependencies).forEach((dependencyName) => {
      const dependencyAsWorkspacePackage = workspacePackages[dependencyName];
      if (dependencyAsWorkspacePackage) {
        markPackageAsDependentOf(packageName, dependencyName);
      }
    });
  });
  return dependencyGraph;
};

export const orderByDependencies = (dependencyGraph) => {
  const visited = [];
  const sorted = [];
  const visit = (packageName, importerPackageName) => {
    const isSorted = sorted.includes(packageName);
    if (isSorted) return;
    const isVisited = visited.includes(packageName);
    if (isVisited) {
      throw new Error(
        `Circular dependency between ${packageName} and ${importerPackageName}`,
      );
    }
    visited.push(packageName);
    dependencyGraph[packageName].dependencies.forEach((dependencyName) => {
      visit(dependencyName, packageName);
    });
    sorted.push(packageName);
  };
  Object.keys(dependencyGraph).forEach((packageName) => {
    visit(packageName);
  });
  return sorted;
};
