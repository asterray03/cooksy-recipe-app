Firebase Admin credentials are now loaded from environment variables.

Required backend env vars:

- `FIREBASE_PROJECT_ID`
- `FIREBASE_CLIENT_EMAIL`
- `FIREBASE_PRIVATE_KEY`

`FIREBASE_PRIVATE_KEY` should keep escaped newlines (for example `\\n`) and code converts them at runtime.
