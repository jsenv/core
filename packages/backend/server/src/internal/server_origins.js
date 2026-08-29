import { isIP } from "node:net";
import { applyDnsResolution } from "./dns_resolution.js";
import { parseHostname } from "./hostname_parser.js";
import { createIpGetters } from "./server_ips.js";

// Decides what the server listens to and the origins it can be reached at:
// - local: favors the hostname (an https certificate is for a hostname, not an ip)
// - localip: the ip behind the hostname
// - externalip: the machine ip on the network, when the server accepts it
// The port is not known yet: the origins are completed once listening.
export const resolveServerOrigins = async ({
  https,
  hostname,
  acceptAnyIp,
  preferIpv6,
}) => {
  const createOrigin = (host) => {
    const protocol = https ? "https" : "http";
    if (isIP(host) === 6) {
      return `${protocol}://[${host}]`;
    }
    return `${protocol}://${host}`;
  };

  const serverOrigins = {
    local: "",
  };
  const ipGetters = createIpGetters();
  let hostnameToListen;
  if (acceptAnyIp) {
    const firstInternalIp = ipGetters.getFirstInternalIp({ preferIpv6 });
    serverOrigins.local = createOrigin(firstInternalIp);
    serverOrigins.localip = createOrigin(firstInternalIp);
    const firstExternalIp = ipGetters.getFirstExternalIp({ preferIpv6 });
    serverOrigins.externalip = createOrigin(firstExternalIp);
    hostnameToListen = preferIpv6 ? "::" : "0.0.0.0";
  } else {
    hostnameToListen = hostname;
  }
  const hostnameInfo = parseHostname(hostname);
  if (hostnameInfo.type === "ip") {
    if (acceptAnyIp) {
      throw new Error(
        `hostname cannot be an ip when acceptAnyIp is enabled, got ${hostname}`,
      );
    }

    preferIpv6 = hostnameInfo.version === 6;
    const firstInternalIp = ipGetters.getFirstInternalIp({ preferIpv6 });
    serverOrigins.local = createOrigin(firstInternalIp);
    serverOrigins.localip = createOrigin(firstInternalIp);
    if (hostnameInfo.label === "unspecified") {
      const firstExternalIp = ipGetters.getFirstExternalIp({ preferIpv6 });
      serverOrigins.externalip = createOrigin(firstExternalIp);
    } else if (hostnameInfo.label === "loopback") {
      // nothing
    } else {
      serverOrigins.local = createOrigin(hostname);
    }
  } else {
    const hostnameDnsResolution = await applyDnsResolution(hostname, {
      verbatim: true,
    });
    if (hostnameDnsResolution) {
      const hostnameIp = hostnameDnsResolution.address;
      serverOrigins.localip = createOrigin(hostnameIp);
      serverOrigins.local = createOrigin(hostname);
    } else {
      const firstInternalIp = ipGetters.getFirstInternalIp({ preferIpv6 });
      // fallback to internal ip because there is no ip
      // associated to this hostname on operating system (in hosts file)
      hostname = firstInternalIp;
      hostnameToListen = firstInternalIp;
      serverOrigins.local = createOrigin(firstInternalIp);
    }
  }
  return { hostname, hostnameToListen, serverOrigins };
};
