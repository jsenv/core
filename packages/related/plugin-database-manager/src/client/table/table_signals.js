import { signal } from "@preact/signals";

export const tablePublicFilterSignal = signal(false);
export const tableInfoSignal = signal({ columns: [], data: [] });
