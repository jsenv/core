import { namespaceGetterToRegister } from "../../namespaceGetterToRegister.js"

export const moduleToRegisterGetter = ({
  fetchSource,
  evalSource,
  remoteFile,
  remoteParent,
  localFile,
}) => {
  return fetchSource({ remoteFile, remoteParent, localFile }).then(
    ({ status, headers, reason, body }) => {
      if (status < 200 || status >= 400) {
        return Promise.reject({ status, reason, headers, body })
      }

      if (headers["content-type"] === "application/javascript") {
        return (System) => {
          evalSource(body, { remoteFile, remoteParent, localFile })
          return System.getRegister()
        }
      }

      if (headers["content-type"] === "application/json") {
        return () => {
          return namespaceGetterToRegister(() => {
            return {
              default: JSON.parse(body),
            }
          })
        }
      }

      return () => undefined
    },
  )
}
