export const serviceWorkerAPI = window.navigator.serviceWorker;
let serviceWorkerUnavailabilityReason;
if (!serviceWorkerAPI) {
  serviceWorkerUnavailabilityReason = "api_not_found_on_navigator";
} else if (!window.isSecureContext) {
  // service workers require a secure context (https, or localhost during dev)
  serviceWorkerUnavailabilityReason = "secure_context_required";
}

export const canUseServiceWorkers = !serviceWorkerUnavailabilityReason;
