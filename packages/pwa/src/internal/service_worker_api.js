export const serviceWorkerAPI = window.navigator.serviceWorker
let serviceWorkerUnavailabilityReason
if (!serviceWorkerAPI) {
  serviceWorkerUnavailabilityReason = "api_not_found_on_navigator"
} else if (document.location.protocol !== "https:") {
  serviceWorkerUnavailabilityReason = "protocol_must_be_https"
}

export const canUseServiceWorkers = !serviceWorkerUnavailabilityReason
