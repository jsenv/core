import { networkInterfaces } from "node:os";

export const createIpGetters = () => {
  const networkAddresses = [];
  const networkInterfaceMap = networkInterfaces();
  for (const key of Object.keys(networkInterfaceMap)) {
    for (const networkAddress of networkInterfaceMap[key]) {
      networkAddresses.push(networkAddress);
    }
  }
  return {
    getFirstInternalIp: ({ preferIpv6 }) => {
      const isPref = preferIpv6 ? isIpV6 : isIpV4;
      let firstInternalIp;
      for (const networkAddress of networkAddresses) {
        if (networkAddress.internal) {
          firstInternalIp = networkAddress.address;
          if (isPref(networkAddress)) {
            break;
          }
        }
      }
      return firstInternalIp;
    },
    getFirstExternalIp: ({ preferIpv6 }) => {
      const isPref = preferIpv6 ? isIpV6 : isIpV4;
      let firstExternalIp;
      for (const networkAddress of networkAddresses) {
        if (!networkAddress.internal) {
          firstExternalIp = networkAddress.address;
          if (isPref(networkAddress)) {
            break;
          }
        }
      }
      return firstExternalIp;
    },
  };
};

const isIpV4 = (networkAddress) => {
  // node 18.5
  if (typeof networkAddress.family === "number") {
    return networkAddress.family === 4;
  }
  return networkAddress.family === "IPv4";
};

const isIpV6 = (networkAddress) => !isIpV4(networkAddress);
