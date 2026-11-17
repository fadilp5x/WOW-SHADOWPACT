# SHADOWPACT

**Ready for Netlify from this GitHub repository.** A cinematic Three.js scene turns an app's official privacy policy into physical robot claws. Live scan stages, sound, example app bubbles and practical release lessons are included.

## Deploy on Netlify

1. In Netlify, choose **Add new project > Import an existing project > GitHub**.
2. Select **fadilp5x/WOW-SHADOWPACT** and the **main** branch.
3. The included `netlify.toml` supplies these settings automatically:

   | Setting | Value |
   | --- | --- |
   | Base directory | Leave blank |
   | Build command | `npm run build` |
   | Publish directory | `dist/client` |
   | Functions directory | `netlify/functions` |
   | Node.js | `24` |

4. Before deploying, add `TINYFISH_API_KEY` in the project's **Environment variables** settings. Use your TinyFish key as the value. Include the **Functions** scope if Netlify offers scope selection, and the Production deploy context. Do not prefix the name with `VITE_`.
5. Choose **Deploy**. Open the site and enter `Instagram` or `instagram.com` to test a live scan.

Use Git-connected deployment. Uploading only `dist/client` through Netlify Drop does not deploy the API functions.

No Netlify API token or separate AI API key is required. No credentials are committed to this repository. After changing a runtime secret, redeploy so the Edge Function receives the updated value.

## Environment variables

| Name | Required | Purpose |
| --- | --- | --- |
| `TINYFISH_API_KEY` | Yes for live scans | Finds and extracts official policy pages. |
| `FIREBASE_SERVICE_ACCOUNT` | Optional | Complete Firebase service-account JSON for Firestore, with Firestore/Datastore User IAM access. |

Leave Firebase unset to use the working seven-day browser cache. For Firestore, enable a database in your Firebase project and set `FIREBASE_SERVICE_ACCOUNT` as a server secret. Its JSON includes the project ID and private key; paste the JSON as a single value with its escaped newline sequences intact. The server refreshes its OAuth access token automatically. The private key must never go in browser code or a `VITE_` variable.

Advanced Firebase alternatives are documented in `.env.example`: a public Firebase config plus a trusted server `FIREBASE_AUTH_TOKEN` can be used instead of a service account. Firebase-token writes require the `shadowpactServer` custom claim and the supplied `firestore.rules`. A web API key alone does not authorize cache writes. Service-account access uses IAM.

## Run locally

Use Node.js 24. Copy `.env.example` to `.env`, set `TINYFISH_API_KEY`, then run:

```sh
npm ci
npm run dev
```

Local development loads `.env` on the server. No shell-specific environment-variable assignment is required, so these commands also work on Windows. Restart the development server after changing `.env`.

```sh
npm run verify
```

This runs the automated tests, builds the browser app, and checks that the real 3D model is present and no server credentials or API source leaked into the published files.

## Netlify architecture

- `dist/client`: the Vite-built page, styles, JavaScript and CC0 animated character.
- `netlify/edge-functions/api.js`: `/api/config` and `/api/analyze`. Policy fetches stream genuine progress as they run. No SPA redirect masks these endpoints.
- `netlify/functions/policy-sort.mjs`: computes the evidence categories and score. It accepts only signed internal calls from the Edge Function, using the existing server secret. No second signing key is required.
- `src/api.js`: shared policy fetching, Firestore caching and evidence analysis.

The split keeps long network waits in a streamed Edge response and the text analysis in a regular server function. This avoids putting a whole slow scan inside Netlify's 60-second regular-function limit or running its text analysis within the Edge CPU budget. External sites can still refuse extraction; the UI reports those failures instead of inventing results.

The UI requests newline-delimited JSON. Each event reports an actual cache, search, extraction, mapping or save stage. Legacy JSON clients receive the final JSON document; errors after response headers have been sent are represented by an `error` field, so clients must check it.

## Data, evidence and cache

Every claw and evidence card is generated from the same `sorted.takes` array. The fixed targets are eyes, ears, mouth, head, heart, hands and briefcase, feet, and vault. The source section and evidence sentence stay attached to each finding. The exposure score is a documented heuristic, not a legal assessment. Missing categories do not establish that an app collects no data.

Configured Firestore is checked first. One document per normalized app name is stored in `apps`, with `appName`, `privacyUrl`, `termsUrl`, `rawText`, `sorted`, `exposureScore`, and `fetchedAt`. A cache hit skips TinyFish. The UI distinguishes Firestore and browser caching. Oversized Firestore documents fall back to browser caching with an explanation.

## Release lessons and animation

The real CC0 Quaternius character uses its bundled animations and a phone-holding pose. The giant computer has at least eight articulated arms. Examples above the characters begin a scan on click. Capture and release sounds start only after a user gesture and can be muted. Reduced-motion preferences are respected.

After the performance, click a claw, use its keyboard-accessible label, or choose a category's action button. Each lesson gives practical iPhone, Android, browser and account guidance. Practice retracts the claw and relaxes the boy's expression. It does not change real account settings, delete collected data, or alter the original policy score. Follow the lesson in the actual app or device to make those changes.

## Other hosting

`npm run build:worker` retains the existing Cloudflare Worker build for the original hosted site. Netlify uses `npm run build`, which needs no Sites account or source-repository credential. The `.openai` metadata is not copied into Netlify's publish directory.

Model attribution: `public/assets/ATTRIBUTION.txt`.
