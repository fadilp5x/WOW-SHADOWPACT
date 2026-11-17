# SHADOWPACT

A complete Three.js web app where the policy analysis drives each articulated claw and the evidence below the scene. The person stands on the left. The giant crowned computer stands on the right.

## Run

Node 24 or later:

```sh
npm install
TINYFISH_API_KEY=your-key npm run dev
```

For a local shell, set the key securely through your environment. Never commit it. Production uses a private server binding named `TINYFISH_API_KEY`. The browser never receives the key.

`npm run build` produces the browser build in `dist/client` and a portable Cloudflare Worker in `dist/server/index.js`. The Worker contains all static assets, including the actual CC0 character model. It serves `/api/config` and `/api/analyze` alongside the site.

## Firebase

The single `FIREBASE_CONFIG` object is at the top of `src/api.js`. It intentionally has empty demo values because no Firebase project was supplied. Paste your Firebase web config there or set the `FIREBASE_CONFIG` server variable to its JSON value. Alternatively set `FIREBASE_PROJECT_ID` and `FIREBASE_API_KEY`. For server writes, set `FIREBASE_SERVICE_ACCOUNT` to a Firebase service account JSON with Firestore IAM access. The server refreshes its OAuth token automatically. Alternatively set a valid `FIREBASE_AUTH_TOKEN` with the trusted `shadowpactServer` custom claim. Deploy the included `firestore.rules` for Firebase token access. Anonymous sign-in supports authenticated reads only; it does not grant write permission.

Configured Firestore is always checked first, using one document per normalized app name in `apps`. Records include `appName`, `privacyUrl`, `termsUrl`, `rawText`, `sorted`, `exposureScore`, and `fetchedAt`. Cache hits skip TinyFish entirely. With no Firebase project configured, the app explicitly uses a seven-day browser cache. The fallback does not claim to be Firestore. Policies too large for Firestore's document limit remain in browser cache with an explicit reason.

## Evidence and animation

TinyFish's real Search endpoint discovers official policy and terms URLs. Fetch extracts both documents. The evidence sorter applies affirmative collection rules with negation checks, records the source section and full evidence sentence, maps categories to the required eight body targets, and computes a sensitivity, sharing, and clause-based score. It is deterministic, with no LLM service or hidden AI key dependency. The score is a heuristic. Conditional clauses and keyword analysis require human review. A missing category is not evidence that an app does not collect it.

The scene has eight idle robot arms and adds arms if the analysis has more categories. Every `takes` entry becomes exactly one claw. The source quotes, categories, targets and final score all come from the same `sorted` object. Retrieved text is rendered as text, never trusted HTML.

The UI uses the UNSEEN palette, Space Grotesk and Inter, continuous Three.js animation, GSAP performance sequencing, and ScrollTrigger reveals. Reduced-motion preferences shorten the performance and remove ambient motion. Model attribution is in `public/assets/ATTRIBUTION.txt`.

## Interactive scanning and release lessons

Enter an app name, domain, or public website URL, or choose an example bubble above a character. Website input is normalized to the app or hostname before searching; the server never directly fetches a user-supplied URL. The top loading line and elapsed timer accompany real streamed stages for cache, official-source search, extraction, mapping and saving. Completed and skipped steps are distinguished. JSON clients remain supported; streaming clients request `Accept: application/x-ndjson`.

Quiet synthesized capture and release sounds activate after a user gesture. The sound button remembers the mute preference. After the performance, select a red claw or its keyboard-accessible label to open practical iPhone, Android, web and account guidance. The practice button opens and retracts that grip. The boy becomes worried with attached claws and relaxes as they are released. Practice does not change external account permissions or the original policy score. The lesson explicitly explains how to change real settings and handle already-collected data separately.
