// Valid: Rest params propagated to function that uses the properties
function processOptions({ mode, ...rest }) {
  return helper({ mode, ...rest });
}

function helper({ mode, debug, verbose }) {
  console.log(mode, debug, verbose);
}

processOptions({ mode: "dev", debug: true, verbose: false });

// Valid: Rest params propagated through multiple functions
function setupApp({ name, ...appConfig }) {
  return configureServer({ name, ...appConfig });
}

function configureServer({ name, ...serverConfig }) {
  return startServer({ name, ...serverConfig });
}

function startServer({ name, port, host }) {
  console.log(`Starting ${name} on ${host}:${port}`);
}

setupApp({ name: "MyApp", port: 3000, host: "localhost" });

// Valid: Rest params with mixed usage patterns
function deployApp({ env, ...deployConfig }) {
  console.log(`Deploying to ${env}`);
  return setupDeployment({ ...deployConfig });
}

function setupDeployment({ region, replicas }) {
  console.log(`Setup in ${region} with ${replicas} replicas`);
}

deployApp({ env: "production", region: "us-east", replicas: 3 });
