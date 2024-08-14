import { urlToFilename } from "@jsenv/urls"
import { assertAndNormalizeDirectoryUrl } from "@jsenv/filesystem"

export const getCertificateAuthorityFileUrls = () => {
  // we need a directory common to every instance of @jsenv/https-local
  // so that even if it's used multiple times, the certificate autority files
  // are reused
  const applicationDirectoryUrl = getJsenvApplicationDirectoryUrl()

  const certificateAuthorityJsonFileUrl = new URL(
    "./https_local_certificate_authority.json",
    applicationDirectoryUrl,
  )

  const rootCertificateFileUrl = new URL(
    "./https_local_root_certificate.crt",
    applicationDirectoryUrl,
  )

  const rootCertificatePrivateKeyFileUrl = new URL(
    "./https_local_root_certificate.key",
    applicationDirectoryUrl,
  ).href

  return {
    certificateAuthorityJsonFileUrl,
    rootCertificateFileUrl,
    rootCertificatePrivateKeyFileUrl,
  }
}

export const getRootCertificateSymlinkUrls = ({
  rootCertificateFileUrl,
  rootPrivateKeyFileUrl,
  serverCertificateFileUrl,
}) => {
  const serverCertificateDirectory = new URL("./", serverCertificateFileUrl)
    .href

  const rootCertificateFilename = urlToFilename(rootCertificateFileUrl)
  const rootCertificateSymlinkUrl = new URL(
    rootCertificateFilename,
    serverCertificateDirectory,
  ).href
  const rootPrivateKeyFilename = urlToFilename(rootPrivateKeyFileUrl)
  const rootPrivateKeySymlinkUrl = new URL(
    rootPrivateKeyFilename,
    serverCertificateDirectory,
  ).href

  return {
    rootCertificateSymlinkUrl,
    rootPrivateKeySymlinkUrl,
  }
}

// https://github.com/LinusU/node-application-config-path/blob/master/index.js
const getJsenvApplicationDirectoryUrl = () => {
  const { platform } = process

  if (platform === "darwin") {
    return new URL(
      `./Library/Application Support/https_local/`,
      assertAndNormalizeDirectoryUrl(process.env.HOME),
    ).href
  }

  if (platform === "linux") {
    if (process.env.XDG_CONFIG_HOME) {
      return new URL(
        `./https_local/`,
        assertAndNormalizeDirectoryUrl(process.env.XDG_CONFIG_HOME),
      ).href
    }
    return new URL(
      `./.config/https_local/`,
      assertAndNormalizeDirectoryUrl(process.env.HOME),
    ).href
  }

  if (platform === "win32") {
    if (process.env.LOCALAPPDATA) {
      return new URL(
        `./https_local/`,
        assertAndNormalizeDirectoryUrl(process.env.LOCALAPPDATA),
      ).href
    }

    return new URL(
      `./Local Settings/Application Data/https_local/`,
      assertAndNormalizeDirectoryUrl(process.env.USERPROFILE),
    ).href
  }

  throw new Error(`platform not supported`)
}
