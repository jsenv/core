export const searchCertificateInCommandOutput = (
  commandOutput,
  certificateAsPEM,
) => {
  commandOutput = commandOutput.replace(/\r\n/g, "\n").trim();
  certificateAsPEM = certificateAsPEM.replace(/\r\n/g, "\n").trim();
  return commandOutput.includes(certificateAsPEM);
};
