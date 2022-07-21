import { networkInterfaces } from "node:os"

import { applyDnsResolution } from "./dns_resolution.js"

export const getServerOrigins = async ({ protocol, host, port }) => {
  const isLocal = LOOPBACK_HOSTNAMES.includes(host)
  const localhostDnsResolution = await applyDnsResolution("localhost")
  const localOrigin = createServerOrigin({
    protocol,
    hostname:
      localhostDnsResolution.address === "127.0.0.1"
        ? "localhost"
        : "127.0.0.1",
    port,
  })
  if (isLocal) {
    return { local: localOrigin }
  }
  const isAnyIp = WILDCARD_HOSTNAMES.includes(host)
  const networkOrigin = createServerOrigin({
    protocol,
    hostname: isAnyIp ? getExternalIp() : host,
    port,
  })
  return {
    local: localOrigin,
    network: networkOrigin,
  }
}

const LOOPBACK_HOSTNAMES = [
  "localhost",
  "127.0.0.1",
  "::1",
  "0000:0000:0000:0000:0000:0000:0000:0001",
]

const WILDCARD_HOSTNAMES = [
  undefined,
  "0.0.0.0",
  "::",
  "0000:0000:0000:0000:0000:0000:0000:0000",
]

const createServerOrigin = ({ protocol, hostname, port }) => {
  const url = new URL("https://127.0.0.1:80")
  url.protocol = protocol
  url.hostname = hostname
  url.port = port
  return url.origin
}

const getExternalIp = () => {
  const networkInterfaceMap = networkInterfaces()
  let internalIPV4NetworkAddress
  Object.keys(networkInterfaceMap).find((key) => {
    const networkAddressArray = networkInterfaceMap[key]
    return networkAddressArray.find((networkAddress) => {
      if (networkAddress.internal) return false
      if (!isIpV4(networkAddress)) return false
      internalIPV4NetworkAddress = networkAddress
      return true
    })
  })
  return internalIPV4NetworkAddress ? internalIPV4NetworkAddress.address : null
}

const isIpV4 = (networkAddress) => {
  // node 18+
  if (typeof networkAddress.family === "number") {
    return networkAddress.family === 4
  }
  return networkAddress.family === "IPv4"
}
