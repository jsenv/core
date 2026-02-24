import { signal } from "@preact/signals";

export const useNetworkSpeed = () => {
  return networkSpeedSignal.value;
};

const connection =
  window.navigator.connection ||
  window.navigator.mozConnection ||
  window.navigator.webkitConnection;

const getNetworkSpeed = () => {
  // ✅ Network Information API (support moderne)
  if (!connection) {
    return "3g";
  }
  if (connection) {
    const effectiveType = connection.effectiveType;
    if (effectiveType) {
      return effectiveType; // "slow-2g", "2g", "3g", "4g", "5g"
    }
    const downlink = connection.downlink;
    if (downlink) {
      // downlink is in Mbps
      if (downlink < 1) return "slow-2g"; // < 1 Mbps
      if (downlink < 2.5) return "2g"; // 1-2.5 Mbps
      if (downlink < 10) return "3g"; // 2.5-10 Mbps
      return "4g"; // > 10 Mbps
    }
  }
  return "3g";
};

const updateNetworkSpeed = () => {
  networkSpeedSignal.value = getNetworkSpeed();
};

export const networkSpeedSignal = signal(getNetworkSpeed());

const setupNetworkMonitoring = () => {
  const cleanupFunctions = [];

  // ✅ 1. Écouter les changements natifs

  if (connection) {
    connection.addEventListener("change", updateNetworkSpeed);
    cleanupFunctions.push(() => {
      connection.removeEventListener("change", updateNetworkSpeed);
    });
  }

  // ✅ 2. Polling de backup (toutes les 60 secondes)
  const pollInterval = setInterval(updateNetworkSpeed, 60000);
  cleanupFunctions.push(() => clearInterval(pollInterval));

  // ✅ 3. Vérifier lors de la reprise d'activité
  const handleVisibilityChange = () => {
    if (!document.hidden) {
      updateNetworkSpeed();
    }
  };

  document.addEventListener("visibilitychange", handleVisibilityChange);
  cleanupFunctions.push(() => {
    document.removeEventListener("visibilitychange", handleVisibilityChange);
  });

  // ✅ 4. Vérifier lors de la reprise de connexion
  const handleOnline = () => {
    updateNetworkSpeed();
  };

  window.addEventListener("online", handleOnline);
  cleanupFunctions.push(() => {
    window.removeEventListener("online", handleOnline);
  });

  // Cleanup global
  return () => {
    cleanupFunctions.forEach((cleanup) => cleanup());
  };
};
setupNetworkMonitoring();
