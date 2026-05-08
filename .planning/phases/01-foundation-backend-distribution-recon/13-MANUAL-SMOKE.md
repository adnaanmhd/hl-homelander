# Plan 13 — Manual on-device smoke checklist

**Status:** OPEN — fill in the checkboxes during the manual smoke; commit the file when complete.

**Operator:** **\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_** **Date:** **\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_** **Device:** Pixel \_\_\_\_ **Android version:** \_\_\_\_

## Pre-requisites

- [ ] `GOOGLE_WEB_CLIENT_ID` filled into `apps/mobile/.env.apkRollout` AND `apps/mobile/.env.playStore`
- [ ] `API_BASE_URL` points at a reachable backend (dev or staging)
- [ ] `adb devices` lists the test device
- [ ] Device is signed in to a Google account

## Build

The two Gradle tasks below produce the apkRolloutDebug + playStoreDebug variants respectively (`<flavor><BuildType>` naming convention).

- [ ] `cd apps/mobile/android && ./gradlew :app:assembleApkRolloutDebug` — exit 0; APK at `app/build/outputs/apk/apkRollout/debug/app-apkRollout-debug.apk`
- [ ] `./gradlew :app:assemblePlayStoreDebug` — exit 0; APK at `app/build/outputs/apk/playStore/debug/app-playStore-debug.apk`

## apkRollout install + sign-in

- [ ] `adb install -r app/build/outputs/apk/apkRollout/debug/app-apkRollout-debug.apk` — Success
- [ ] App launches; SignIn screen renders with title + Continue with Google button
- [ ] Tap Continue with Google → Google account picker opens → select test account → app returns to its own UI
- [ ] Welcome view renders with the Google account display name
- [ ] Backend log shows `POST /auth/nonce 200` followed by `POST /auth/google 200`
- [ ] Backend log shows `flavor=apkRollout, applicationId=ai.humynlabs.capture.apk` on the /auth/google line
- [ ] Decoded JWT (paste into jwt.io or `node -e`) shows `{ flavor: 'apkRollout', applicationId: 'ai.humynlabs.capture.apk', integrity_verdict: 'bypassed_apk' OR 'passed', token_version: 1 }`
- [ ] (Optional) `adb uninstall ai.humynlabs.capture.apk` to clean up before the playStore step

## playStore install + sign-in

- [ ] `adb install -r app/build/outputs/apk/playStore/debug/app-playStore-debug.apk` — Success
- [ ] App launches; SignIn screen renders
- [ ] Tap Continue with Google → Welcome view renders with the Google account display name
- [ ] Backend log shows `POST /auth/google 200` with `flavor=playStore, applicationId=ai.humynlabs.capture`
- [ ] Decoded JWT shows `{ flavor: 'playStore', applicationId: 'ai.humynlabs.capture', integrity_verdict: 'passed', token_version: 1 }` — **NOT** `bypassed_apk` (playStore must always be the strict path)

## Distinctness

- [ ] The two JWTs differ in `flavor` AND `applicationId` AND `integrity_verdict`
- [ ] Same Google account → same `sub` (or different account → different `sub`); both behaviours are acceptable

## Sign-off

Operator signature: **\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_\_**

Approved? **YES / NO**

If NO: describe the failure mode and link to the bug ticket below.

---

## Notes / failures
