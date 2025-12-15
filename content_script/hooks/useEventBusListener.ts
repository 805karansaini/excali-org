import { useEffect } from "react";
import { eventBus, InternalEventTypes } from "../messaging/InternalEventBus";

type Handler = (
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  payload: any,
) => void | Promise<void>;

/**
 * Subscribes to an event bus event and cleans up automatically.
 */
export const useEventBusListener = (
  eventType: InternalEventTypes,
  handler: Handler,
) => {
  useEffect(() => {
    const unsubscribe = eventBus.on(eventType, handler);
    return () => unsubscribe?.();
  }, [eventType, handler]);
};
