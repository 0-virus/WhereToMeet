# Android TWA setup — blocked until real identity and tools are supplied

No Android application, signing key, APK or AAB has been generated. This folder is executable setup, not a claim of an installable app. The owner must supply an owned HTTPS origin, a permanent package ID, the **Play App Signing certificate** SHA-256, Play account access, upload-key custody/backup, an installed JDK/Android SDK/Bubblewrap, adequate disk space and a physical test device. Do not invent these values. Do not put key passwords or private keys in Git.

Set the following environment variables in a local PowerShell session (or a private environment file for the Node commands). Values are intentionally omitted:

| Variable | Source |
| --- | --- |
| `APP_ORIGIN` | Owned public HTTPS origin; no path, query, credentials, custom port or IP |
| `ANDROID_PACKAGE_ID` | Owner's permanent reverse-domain Android identifier |
| `PLAY_APP_SIGNING_SHA256` | Play Console app integrity → App signing key certificate SHA-256; colon-separated 32 bytes |
| `ANDROID_HOME` | Existing Android SDK location |
| `ANDROID_KEYSTORE_PATH` | Absolute path to the owned upload keystore, outside the repository |
| `ANDROID_KEY_ALIAS` | Upload-key alias |
| `VITE_OPERATOR_NAME`, `VITE_OPERATOR_CONTACT` | Actual operator and public support email, built into privacy UI |

The upload key normally differs from the certificate of the app distributed by Play. The site's Digital Asset Links must contain the Play certificate. A locally signed APK needs its **actual** local certificate in the test site's association file to verify locally. Do not replace production Play association with a debug/upload certificate. Document certificate rotation and every intended additional certificate explicitly. [Android TWA guide](https://developer.android.com/develop/ui/views/layout/webapps/guide-trusted-web-activities-version2)

Run from the repository root with Node 24 on `PATH`:

```powershell
node scripts/android-config.mjs
npm run build
powershell -NoProfile -File scripts/android.ps1 preflight
```

Configuration generation validates all three identity values before writing `public/.well-known/assetlinks.json` and ignored `android/identity.json`. Review the public association file and commit it only after identity approval. `preflight` checks installed `java`, `bubblewrap`, `adb`, `ANDROID_HOME`, and `bubblewrap doctor`; it does not install anything. Bubblewrap may offer downloads during its own commands; decline them on this constrained machine. Installation of tools, SDK licenses, accounts and costs requires separate preparation.

After the authorized web deployment has made the actual HTTPS manifest reachable:

```powershell
powershell -NoProfile -File scripts/android.ps1 init
powershell -NoProfile -File scripts/android.ps1 build
```

`init` runs `bubblewrap init --manifest <actual origin>/manifest.webmanifest --directory android/app`. At interactive prompts, use the exact approved package ID, launch path `/`, application name `어디서 만나`, intended orientation and the owner-managed upload key. The script verifies the resulting host and package ID. Review `android/app/twa-manifest.json`, version code, signing setup and generated Android project before building. `build` runs Bubblewrap without skip-validation or skip-signing flags and expects `android/app/app-release-signed.apk` and `android/app/app-release-bundle.aab`. This is not an upload command. Bubblewrap's generated directory is ignored so keys, builds and local SDK paths cannot be committed accidentally. [Bubblewrap commands and configuration](https://github.com/GoogleChromeLabs/bubblewrap/blob/main/packages/cli/README.md)

After explicit authorization to use the owner's internal Play track, distribute through that track to validate the **Play-signed** application. Record package/version, device/OS/browser version, certificate SHA-256, installed source, deployed revision, test date and observed outcome in the Android evidence report. Never record participant addresses, coordinates, session tokens or keys.

Required physical-device cases: first launch; Android back from details/results/input; background/resume; process kill/relaunch; app update; offline start and recovery; external Kakao map → return; share → cancel/return; system font size and 360px equivalent viewport; installed/uninstalled direct public hub links; Chrome and Samsung Internet fallback; deliberately failed DAL verification (visible browser toolbar, usable web app). Separately test mobile Safari as web only. Verify no new location permission is requested. A desktop browser test does not pass these cases.

Signing custody record (owner fills before internal distribution): key owner, encrypted backup location, recovery custodian, upload-key reset procedure, Play App Signing enrollment, SHA-256 and certificate rotation plan. Store the actual secrets outside this record. For rollback, stop the staged rollout and rebuild the last stable web-compatible revision with a **higher Android version code**; Android does not accept an ordinary lower-version replacement. Keep the existing package ID and signing lineage. See [deployment and rollback](../docs/DEPLOYMENT.md).
