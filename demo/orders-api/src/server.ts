import { createApp } from './app.js';
import { loadConfig } from './config.js';

const config = loadConfig();
createApp().listen(config.port, () => {
  console.log(`orders-api listening on :${config.port}`);
});
