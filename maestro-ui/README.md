# UiPath Maestro Process Management App

Application React TypeScript pour gérer les processus UiPath Maestro avec authentification OAuth.

## Prérequis

- Node.js 18+ installé
- Accès à un tenant UiPath Cloud
- Application OAuth externe configurée dans UiPath Admin Center

## Configuration OAuth

1. Dans UiPath Cloud : **Admin → External Applications**
2. Cliquez sur **Add Application → Non Confidential Application**
3. Configurez :
   - **Nom** : Votre nom d'application (ex: "Maestro Process Manager")
   - **Redirect URI** : `http://localhost:5173` (pour le développement)
   - **Scopes** : Sélectionnez les scopes requis (orchestrator, maestro, DataFabric)
4. Sauvegardez et copiez le **Client ID**

## Installation

1. Copiez le fichier de configuration :
```bash
cp .env.example .env
```

2. Modifiez `.env` avec vos identifiants UiPath :
```env
VITE_UIPATH_CLIENT_ID=votre-client-id-oauth
VITE_UIPATH_ORG_NAME=votre-organization
VITE_UIPATH_TENANT_NAME=votre-tenant
VITE_UIPATH_BASE_URL=https://cloud.uipath.com
VITE_UIPATH_REDIRECT_URI=http://localhost:5173
VITE_UIPATH_SCOPE=OR.Execution OR.Folders OR.Jobs PIMS DataFabric.Schema.Read DataFabric.Data.Read DataFabric.Data.Write
```

3. Mettez à jour votre `orgName` dans `vite.config.ts` :
```typescript
server: {
  proxy: {
    '/votre-org': {  // Remplacez par votre organisation
      target: 'https://cloud.uipath.com',
      changeOrigin: true,
      secure: true,
    },
  },
}
```

4. Installez les dépendances :
```bash
npm install
```

5. Démarrez le serveur de développement :
```bash
npm run dev
```

6. Ouvrez votre navigateur à `http://localhost:5173`

## Flux d'authentification

1. Cliquez sur "Se connecter avec UiPath"
2. Vous serez redirigé vers UiPath Cloud pour l'authentification
3. Après connexion réussie, vous reviendrez sur le tableau de bord
4. L'application initialisera automatiquement le SDK UiPath

## Structure de l'application

```
src/
├── components/          # Composants React
│   ├── Dashboard.tsx    # Tableau de bord avec statistiques
│   ├── Header.tsx       # En-tête avec état d'auth
│   ├── LoginScreen.tsx  # Interface de connexion OAuth
│   ├── Navigation.tsx   # Navigation par onglets
│   └── ProcessList.tsx  # Vue des processus Maestro
├── hooks/
│   └── useAuth.tsx      # Contexte et hooks d'authentification
├── services/
│   └── auth.ts          # Implémentation du service OAuth
└── App.tsx              # Composant principal
```

## Fonctionnalités

### Tableau de bord
- Statistiques des processus en temps réel
- Indicateurs de statut système

### Gestion des processus
- Visualiser tous les processus Maestro
- Démarrer des instances de processus
- Mises à jour de statut en temps réel

## Technologies utilisées

- React 18 avec TypeScript
- Vite pour le développement et le build
- Tailwind CSS pour le style
- SDK TypeScript UiPath pour l'intégration API
- OAuth 2.0 pour l'authentification sécurisée

## Build pour la production

```bash
npm run build
```

## Dépannage

### Problèmes courants

1. **L'authentification échoue** : Vérifiez votre Client ID OAuth et Redirect URI
2. **Erreurs API** : Assurez-vous que votre utilisateur a les permissions Maestro
3. **Erreurs de build** : Vérifiez que toutes les variables d'environnement sont définies

### Aide

- Documentation SDK : https://uipath.github.io/uipath-typescript/
      tseslint.configs.stylisticTypeChecked,

      // Other configs...
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```

You can also install [eslint-plugin-react-x](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-x) and [eslint-plugin-react-dom](https://github.com/Rel1cx/eslint-react/tree/main/packages/plugins/eslint-plugin-react-dom) for React-specific lint rules:

```js
// eslint.config.js
import reactX from 'eslint-plugin-react-x'
import reactDom from 'eslint-plugin-react-dom'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // Other configs...
      // Enable lint rules for React
      reactX.configs['recommended-typescript'],
      // Enable lint rules for React DOM
      reactDom.configs.recommended,
    ],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.node.json', './tsconfig.app.json'],
        tsconfigRootDir: import.meta.dirname,
      },
      // other options...
    },
  },
])
```
