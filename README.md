Voici les commandes pour lancer le backend et le frontend Maestro UI :

1. Lancer le backend
        cd /Users/ludovic.duverger/Projets/CM_Credit_APPV2/backend
        npm install
        npm run dev

2. Lancer le frontend (Maestro UI)
cd /Users/ludovic.duverger/Projets/CM_Credit_APPV2/maestro-ui
        npm install
        npm run dev

Astuce :
Pour tuer tous les serveurs Node.js sur le port :3001:
        lsof -ti :3001 | xargs kill -9