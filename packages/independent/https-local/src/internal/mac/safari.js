export const executeTrustQueryOnSafari = ({ macTrustInfo }) => {
  return {
    status: macTrustInfo.status,
    reason: macTrustInfo.reason,
  };
};
