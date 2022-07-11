import { lookup } from "node:dns"

export const applyDnsResolution = async (hostname) => {
  const dnsResolution = await new Promise((resolve, reject) => {
    lookup(hostname, (error, address, family) => {
      if (error) {
        reject(error)
      } else {
        resolve({ address, family })
      }
    })
  })
  return dnsResolution
}
