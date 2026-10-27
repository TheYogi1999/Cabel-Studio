# Firebase cloud setup

Leitwerk uses **Firebase Authentication (email/password)** and **Realtime Database**. The static app can stay on GitHub Pages. No private server key belongs in this repository or browser.

The hosted Leitwerk app is preconfigured with the public Web App settings for **leitwerk-prod-dffe5** and its Belgium Realtime Database. For that project, complete steps 3 and 5 below in the Firebase Console; the Web App settings do not need to be pasted again. For a separate Firebase project, follow all steps.

## Create the Firebase project

1. Open [Firebase Console](https://console.firebase.google.com/) in your Google account and create a project. Analytics is optional.
2. Add a **Web app** in Project settings. Copy its public `firebaseConfig` object.
3. Under **Build → Authentication → Sign-in method**, enable **Email/Password**. Under Authentication settings, add `theyogi1999.github.io` to **Authorized domains** (and your own domain if applicable).
4. Under **Build → Realtime Database**, create a database. Choose the region appropriate for your project. Start in **locked mode**.
5. In **Realtime Database → Rules**, publish the complete contents of [database.rules.json](database.rules.json). Do not use public/test rules. These rules enforce project membership, roles, immutable revisions and transaction sequence numbers.
6. Copy the database URL from the Data tab into `firebaseConfig.databaseURL`. It may use `firebasedatabase.app` or `firebaseio.com`, depending on region.
7. In Leitwerk, open **Projects → Cloud setup** and paste the configuration as valid JSON (double quotes, no `const firebaseConfig =` wrapper). Repeat on iPad and PC. Alternatively, set `globalThis.LEITWERK_FIREBASE_CONFIG = {...}` in [../firebase-config.js](../firebase-config.js) and publish the app once for all devices.
8. Create an account in Leitwerk, then **Save current project to cloud**. Sign in on the other device and open the same project.

**Cloud setup** remains available on the sign-in screen and project overview if settings need correcting. A browser-specific configuration overrides the hosted default. Changing an active Firebase connection signs out and reloads the app after checking pending edits.

The Web App `apiKey` and the other settings are public identifiers, not database authorization. Access is enforced by Authentication and the database rules. Do not paste passwords, refresh tokens or service-account JSON into Cloud setup.

Firebase setup, rules publication and billing belong to the Google account that owns the project. The repository does not create a Firebase account, enable billing or deploy rules automatically. Check the Firebase Console for current service quotas and usage; frequent saves and revision snapshots consume database bandwidth/storage.

## Share and release

- Sign in on both of your devices with the **same account** for your own iPad/PC workflow.
- To share with another person, they create an account and choose **Copy my user ID**. The owner adds that ID under **Current project → Project access**, chooses **Editor** or **Viewer**, and sends them the project ID. They can use **Open shared project** if it is not already listed.
- Owners change an existing member’s **Editor / Viewer** role using the dropdown beside their user ID in **Project access**. Changes save automatically; pending controls are disabled and failed/offline changes revert to the confirmed role. A transaction refuses to recreate a removed member. The owner’s role cannot be changed from this UI. The other signed-in session receives the new editing/read-only permission without a reload. These changes use the existing membership access rules.
- Owners manage membership and create **Released** revisions. Editors edit and save draft revisions. Viewers can open/export the working copy and saved revisions but cannot change cloud data.
- **Save revision / release** creates an immutable snapshot of the entire project, all drawings and annotations included. Opening one is read only. **Restore as working copy** first saves a draft of the previous working state, then restores into a new working state. It never edits or deletes a released revision.
- Release is an owner action, not a digital signature or multi-stage approval workflow. Issued / Check / Release fields in the drawing remain project content and are captured in the revision.

## Simultaneous work and recovery

The latest working state is observed live and changes are saved automatically after an edit finishes. Different drawing sheets merge automatically. Electrical content on a sheet is atomic: concurrent edits to the same sheet require explicit selection of the local/cloud sheet. Cable-definition changes that overlap remote drawing changes also require review. This preserves the relationship between devices, routes, junctions and cable cores. It is not simultaneous editing of individual symbols on the same sheet.

The **Projects** conflict screen offers both versions as JSON downloads and a choice for every overlap. Unrelated sheets are retained. If a third device edits again before the choice saves, another conflict can appear.

Zoom/pan, current sheet, selection and clipboard belong to each device. Cloud objects use UUIDs. Applying remote content clears local Undo/Redo so an old snapshot cannot undo another device's work. Undo/Redo works normally between incoming document changes.

During an offline period the current document remains editable. Finished edits are backed up in **IndexedDB on that device** and synchronize on reconnect, with the same conflict checks. The Firebase browser Realtime Database queue alone is not durable across reloads; **Device recovery** lists the separate recovery copies, which can be downloaded or restored locally. Recovery is offered explicitly after a reload; it never overwrites the cloud automatically. Browser storage can be cleared or unavailable, so JSON export remains useful. A warning appears if recovery storage fails. The app warns before closing a tab with pending changes, although mobile OS termination cannot be prevented.

Cloud documents and each revision have a **4,000,000-character JSON limit** in this initial implementation. History stores full snapshots. Only named draft/released revisions are kept in the shared revision history; automatic working-state updates increment its sequence but are not individual revisions. Device recovery retains the latest copy per browser tab session and project. There is no project deletion or revision deletion UI in this version.

## Quotas and data volume

The [Realtime Database pricing table](https://firebase.google.com/pricing) lists these **Spark** limits per project: **1 GB stored**, **10 GB downloaded per month** and **100 simultaneous connections**. One connected browser tab/device typically uses one connection; this is not a limit of 100 registered users. Check the project's actual plan and **Realtime Database → Usage** in the Firebase Console.

Realtime Database usage is based on stored data and network traffic, rather than Firestore-style daily document-read/write allowances. There are also [operation/rate limits](https://firebase.google.com/docs/database/usage/limits), including a guideline of 1,000 writes/second per database (sustained excess may be rate-limited). [Downloaded traffic includes protocol/encryption overhead](https://firebase.google.com/docs/database/usage/billing); rejected operations can also consume bandwidth. Blaze provides higher connection capacity and usage-based billing; check its current pricing before changing plans.

Leitwerk's current working copy and every named revision store a full project snapshot. Cloud synchronization currently transmits full document states after finished edits. Large projects, many revisions and multiple devices therefore affect storage/traffic, independently of how many projects appear in the overview. A single project/revision is limited by Leitwerk to **4,000,000 JSON string characters**, including the database rule check; this is an application limit, not Firebase's total storage limit. Project search itself filters already-loaded metadata and generates no new database reads. The app does not display account-wide quota usage because it does not have administrative access to Firebase metrics.

## Data layout

```text
userProjects/{uid}/{projectId} = true
projects/{projectId}/owner
projects/{projectId}/members/{uid} = owner | editor | viewer
projects/{projectId}/meta = { title, createdAt }
projects/{projectId}/head = { document, sequence, updatedAt, updatedBy }
projects/{projectId}/revisions/{revisionId} = { name, status, document,
    sourceSequence, createdAt, createdBy }
projects/{projectId}/presence/{uid}/{sessionId} = { name, sheet, seenAt }
```

`document` is a JSON string using the existing drawing/project data. Generated lists are regenerated by the editor. Camera/view state and `nextId` are excluded. `head` uses an optimistic Realtime Database transaction and a three-way merge against the session's last synchronized base. Authentication UIDs identify authors. Presence is per tab/device and is removed on disconnect; stale sessions are hidden after 90 seconds.

## Build and verify

```sh
npm ci
npm run build:firebase
npm run test:cloud
npm run test:firebase
```

The SDK bundle in `vendor/` is checked in so runtime needs no package manager or CDN. The build uses pinned Firebase/esbuild versions in `package-lock.json` and retains license notices. Use Node.js 24.12+ and Java 21+ for the Firebase checks. The emulator test uses **demo-leitwerk** and localhost only; it does not access production data. Tests cover actual rules and two browser sessions against local Authentication/Realtime Database emulators. A production Firebase project still needs the setup above and a real-device iPad/PC acceptance check.

With Firebase CLI access in the owning Google account, rules can also be published using:

```sh
npx firebase deploy --only database --project YOUR_FIREBASE_PROJECT_ID
```
