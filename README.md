Voici les commandes pour lancer le backend et le frontend Maestro UI :

1. Lancer le backend
        cd ./backend
        npm install
        npm run dev

2. Lancer le frontend (Maestro UI)
cd ./maestro-ui
        npm install
        npm run dev

Astuce :
Pour tuer tous les serveurs Node.js sur le port :3001:
        lsof -ti :3001 | xargs kill -9