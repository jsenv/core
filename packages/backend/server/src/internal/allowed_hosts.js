import { hostname as osHostname, networkInterfaces } from "node:os";

// The Host header of a request is compared to the names the server can
// legitimately be reached at. Without this a page served by another site
// reads the responses once its DNS name is rebound to this machine (DNS
// rebinding): the request then comes from the developer's own browser, so
// listening on localhost does not help, only the Host name tells.
export const createHostChecker = ({
  allowedHosts,
  hostname,
  serverOrigins,
  acceptAnyIp,
}) => {
  if (allowedHosts === true) {
    return () => true;
  }

  const allowedHostSet = new Set();
  const allowedHostSuffixes = [];
  const allow = (host) => {
    if (host.startsWith(".")) {
      // ".example.com" allows example.com and every subdomain
      allowedHostSuffixes.push(host.toLowerCase());
      allowedHostSet.add(host.slice(1).toLowerCase());
      return;
    }
    const hostNormalized = normalizeHost(host);
    if (hostNormalized) {
      allowedHostSet.add(hostNormalized);
    }
  };

  allow("localhost");
  allow("127.0.0.1");
  allow("[::1]");
  allow(hostname);
  for (const origin of Object.values(serverOrigins)) {
    allow(new URL(origin).hostname);
  }
  // the name other machines use for this one (mDNS gives "name.local")
  const machineName = osHostname();
  allow(machineName);
  if (!machineName.endsWith(".local")) {
    allow(`${machineName}.local`);
  }
  if (acceptAnyIp) {
    for (const addresses of Object.values(networkInterfaces())) {
      for (const { address, family } of addresses) {
        allow(family === "IPv6" || family === 6 ? `[${address}]` : address);
      }
    }
  }
  for (const allowedHost of allowedHosts) {
    allow(allowedHost);
  }

  return (host) => {
    if (host === undefined) {
      // an http/1.0 client; a browser always sends the header
      return true;
    }
    const hostNormalized = normalizeHost(host);
    if (hostNormalized === null) {
      return false;
    }
    if (allowedHostSet.has(hostNormalized)) {
      return true;
    }
    for (const suffix of allowedHostSuffixes) {
      if (hostNormalized.endsWith(suffix)) {
        return true;
      }
    }
    return false;
  };
};

// "example.com:3456" or "[::1]:3456": the port is not part of the name
const normalizeHost = (host) => {
  const url = `http://${host}`;
  if (!URL.canParse(url)) {
    return null;
  }
  return new URL(url).hostname.toLowerCase();
};
