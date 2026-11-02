import type { AybelApi } from './contract';
import { httpApi } from './httpApi';
import { mockApi } from './mock/mockApi';

/** Switch with VITE_API_MODE=http. Defaults to the in-browser mock. */
export const api: AybelApi = import.meta.env.VITE_API_MODE === 'http' ? httpApi : mockApi;

export * from './contract';
