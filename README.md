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

## Redemarrage rapide

Depuis la racine du projet, utilise deux terminaux.

1. Redemarrer le backend
```powershell
cd backend
npm run dev
```

2. Redemarrer le frontend
```powershell
cd maestro-ui
npm run dev
```

URLs utiles :

- Frontend : `http://localhost:5175`
- Backend : `http://localhost:3001`

Si un ancien process Node bloque les ports :

```powershell
Get-Process node | Stop-Process -Force
```
