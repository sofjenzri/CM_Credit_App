import { createApp } from './app.js';
import { hasClientCredentials, hasUiPathBaseConfig } from './config/uipath.js';

const port = process.env.PORT || 3001;
const { app, hasFrontendBuild } = createApp();

app.listen(port, () => {
  console.log(`Backend démarré sur http://localhost:${port}`);
  console.log(`Mode données: ${hasUiPathBaseConfig() ? 'UiPath réel' : 'Mock (config incomplète)'}`);
  console.log(`Auth backend: ${hasClientCredentials() ? 'client_credentials actif' : 'attente Bearer OAuth en header'}`);
  console.log(`Frontend statique: ${hasFrontendBuild ? 'maestro-ui/dist servi par le backend' : 'non servi (utiliser maestro-ui en dev ou builder le frontend)'}`);
});
