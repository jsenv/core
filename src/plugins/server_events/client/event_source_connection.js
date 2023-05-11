import { createConnectionManager } from "./connection_manager.js";
import { createEventsManager } from "./events_manager.js";

export const createEventSourceConnection = (
  eventSourceUrl,
  {
    withCredentials = true,
    lastEventId,
    useEventsToManageConnection = true,
    retry = false,
    retryMaxAttempt = Infinity,
    retryAllocatedMs = Infinity,
  } = {},
) => {
  const eventSourceOrigin = new URL(eventSourceUrl).origin;
  const attemptConnection = ({ onOpen, onClosed }) => {
    const url = lastEventId
      ? addLastEventIdIntoUrlSearchParams(eventSourceUrl, lastEventId)
      : eventSourceUrl;
    let eventSource = new EventSource(url, { withCredentials });
    eventSource.onerror = () => {
      eventSource.onerror = null;
      eventSource.onopen = null;
      eventSource.onmessage = null;
      eventSource = null;
      onClosed();
    };
    eventSource.onopen = () => {
      eventSource.onopen = null;
      onOpen();
    };
    eventSource.onmessage = (messageEvent) => {
      if (messageEvent.origin === eventSourceOrigin) {
        if (messageEvent.lastEventId) {
          lastEventId = messageEvent.lastEventId;
        }
        const event = JSON.parse(messageEvent.data);
        eventsManager.triggerCallbacks(event);
      }
    };
    return () => {
      if (eventSource) {
        eventSource.close();
      }
    };
  };
  const connectionManager = createConnectionManager(attemptConnection, {
    retry,
    retryMaxAttempt,
    retryAllocatedMs,
  });
  const eventsManager = createEventsManager({
    effect: () => {
      if (useEventsToManageConnection) {
        connectionManager.connect();
        return () => {
          connectionManager.disconnect();
        };
      }
      return null;
    },
  });

  return {
    readyState: connectionManager.readyState,
    listenEvents: (namedCallbacks) => {
      return eventsManager.addCallbacks(namedCallbacks);
    },
    destroy: () => {
      connectionManager.destroy();
      eventsManager.destroy();
    },
  };
};

const addLastEventIdIntoUrlSearchParams = (url, lastEventId) => {
  if (url.indexOf("?") === -1) {
    url += "?";
  } else {
    url += "&";
  }
  return `${url}last-event-id=${encodeURIComponent(lastEventId)}`;
};
