import { lookup } from "node:dns"

export const applyDnsResolution = async (
  hostname,
  { verbatim = false } = {},
) => {
  const dnsResolution = await new Promise((resolve, reject) => {
    lookup(hostname, { verbatim }, (error, address, family) => {
      if (error) {
        reject(error)
      } else {
        resolve({ address, family })
      }
    })
  })
  return dnsResolution
}
