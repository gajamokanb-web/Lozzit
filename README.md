# Lozzit

Calorie tracker (Expo / React Native, Android first). First launch walks you through creating a profile; meals, water and profile are stored on the phone.

![preview](assets/preview.png)

## Get the APK
Every push to `main` triggers the **Android APK** workflow (Actions tab). When it is green, open
**Releases → Lozzit APK (latest)** on your phone and install `lozzit.apk`
(allow installs from your browser when Android asks).
The APK is signed with the Expo debug key: fine for testing, not for the Play Store.

## Dev
```
npm install
npm run typecheck
npx expo start
```
Data lives in AsyncStorage on the device (`src/store.tsx`). Steps are not wired yet.
Font: Plus Jakarta Sans. Icons: Lucide (ISC). Meal photos: Wikimedia Commons, CC BY-SA.
