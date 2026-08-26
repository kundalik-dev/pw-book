import { HttpApiClient } from './httpClient';
import { MockApiClient } from './mock/mockClient';
import type { ApiClient } from './types';

// Phases 1-5 (DB + backend API) aren't built yet, so this defaults to the
// mock client. Set VITE_USE_MOCK_API=false once a real backend is running to
// switch to HttpApiClient without touching any page/component code.
const useMock = import.meta.env.VITE_USE_MOCK_API !== 'false';

export const apiClient: ApiClient = useMock
  ? new MockApiClient()
  : new HttpApiClient(import.meta.env.VITE_API_BASE_URL);
