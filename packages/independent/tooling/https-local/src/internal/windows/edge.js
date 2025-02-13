export const executeTrustQueryOnEdge = ({ windowsTrustInfo }) => {
  return {
    status: windowsTrustInfo.status,
    reason: windowsTrustInfo.reason,
  };
};
