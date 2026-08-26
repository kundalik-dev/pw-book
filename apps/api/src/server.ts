import { createApp } from './app';
import { config } from './config';
import { connectWithRetry } from './db/pool';

const app = createApp();

app.listen(config.port, () => {
  console.log(`[api] listening on port ${config.port}`);
});

void connectWithRetry();
