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

## Deploy frontend with EAS

The frontend depends on Expo public env vars at build time. Local development works because `frontend/.env` exists, but cloud builds will fail or boot into a broken app if these are not set in EAS.

Set these in the Expo/EAS project before building:

```bash
eas env:create --name EXPO_PUBLIC_API_URL --value https://your-public-api-domain.com
eas env:create --name EXPO_PUBLIC_FIREBASE_API_KEY --value your-firebase-api-key
eas env:create --name EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN --value your-project.firebaseapp.com
eas env:create --name EXPO_PUBLIC_FIREBASE_PROJECT_ID --value your-project-id
eas env:create --name EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET --value your-project.appspot.com
eas env:create --name EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID --value your-messaging-sender-id
eas env:create --name EXPO_PUBLIC_FIREBASE_APP_ID --value your-firebase-app-id
eas env:create --name EXPO_PUBLIC_GOOGLE_EXPO_CLIENT_ID --value your-expo-google-client-id
eas env:create --name EXPO_PUBLIC_GOOGLE_ANDROID_CLIENT_ID --value your-android-google-client-id
eas env:create --name EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID --value your-ios-google-client-id
eas env:create --name EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID --value your-web-google-client-id
```

Build from `frontend/`, not the repo root:

```bash
cd frontend
eas build --platform android --profile production
```
