# cooksy-recipe-app

Monorepo structure:

- `backend/` - Node/Express API
  - `controllers/`
  - `routes/`
  - `services/`
  - `firebase/`
  - `server.js`
  - `package.json`
  - `.env.example`
- `frontend/` - Expo React Native app
  - `app/`
  - `components/`
  - `services/`
  - `assets/`
  - `package.json`
  - `app.json`

## Run locally

Backend:

```bash
cd backend
npm install
npm run dev
```

Frontend:

```bash
cd frontend
npm install
npm start
```
