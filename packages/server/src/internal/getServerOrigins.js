import { networkInterfaces } from "node:os"

export const getServerOrigins = ({ protocol, ip, port }) => {
  const isInternalIp = ip === "127.0.0.1"
  const internalOrigin = createServerOrigin({
    protocol,
    hostname: "localhost",
    port,
  })
  if (isInternalIp) {
    return { internal: internalOrigin }
  }
  const isAnyIp = !ip || ip === "::" || ip === "0.0.0.0"
  return {
    internal: internalOrigin,
    external: createServerOrigin({
      protocol,
      hostname: isAnyIp ? getExternalIp(ip) : ip,
      port,
    }),
  }
}

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
      if (networkAddress.family !== "IPv4") return false
      internalIPV4NetworkAddress = networkAddress
      return true
    })
  })
  return internalIPV4NetworkAddress ? internalIPV4NetworkAddress.address : null
}
