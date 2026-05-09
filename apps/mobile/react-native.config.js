// react-native-asset font linker config (D-UI-03 / 02-02 Task 2).
//
// `npx react-native-asset` reads this file and copies any TTF/OTF in the
// listed directories into:
//   - android/app/src/main/assets/fonts/  (Android registers them by file name)
//   - ios/<App>/Fonts/                   (iOS adds them to the bundle resources)
//
// Brand family is RethinkSans per design-spec §0.2; the static .ttf weights
// for Regular / Medium / SemiBold / Bold / ExtraBold land under
// apps/mobile/assets/fonts/.
module.exports = {
  project: { android: {} },
  assets: ['./assets/fonts/'],
};
