import { isIP } from "node:net"

export const parseHostname = (hostname) => {
  if (hostname === "0.0.0.0") {
    return {
      type: "ip",
      label: "unspecified",
      version: 4,
    }
  }
  if (
    hostname === "::" ||
    hostname === "0000:0000:0000:0000:0000:0000:0000:0000"
  ) {
    return {
      type: "ip",
      label: "unspecified",
      version: 6,
    }
  }
  if (hostname === "127.0.0.1") {
    return {
      type: "ip",
      label: "loopback",
      version: 4,
    }
  }
  if (
    hostname === "::1" ||
    hostname === "0000:0000:0000:0000:0000:0000:0000:0001"
  ) {
    return {
      type: "ip",
      label: "loopback",
      version: 6,
    }
  }
  const ipVersion = isIP(hostname)
  if (ipVersion === 0) {
    return {
      type: "hostname",
    }
  }
  return {
    type: "ip",
    version: ipVersion,
  }
}
