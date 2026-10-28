import { createApiClient } from './api-client';
const baseUrl = import.meta.env.VITE_API_BASE_URL;
if (!baseUrl) throw new Error('Missing VITE_API_BASE_URL; copy .env.example to .env.local');
export const api = createApiClient(baseUrl);
