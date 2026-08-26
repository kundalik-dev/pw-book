import { HttpApiClient } from './httpClient';
import { MockApiClient } from './mock/mockClient';
import type { ApiClient } from './types';

// Phases 1-5 (DB + backend API) are built and verified — the real API is the
// default. Set VITE_USE_MOCK_API=true to fall back to the in-memory mock
// client (e.g. offline work, no local SQL Server running) without touching
// any page/component code.
const useMock = import.meta.env.VITE_USE_MOCK_API === 'true';

export const apiClient: ApiClient = useMock
  ? new MockApiClient()
  : new HttpApiClient(import.meta.env.VITE_API_BASE_URL);
