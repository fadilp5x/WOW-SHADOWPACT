// Practical controls for the evidence categories used by the scene.
// These are general device and account instructions, not promises about an app.
const TARGETS = Object.freeze({
  EYES: {
    title: 'Take back your eyes.',
    intro: 'Limit future camera and photo access, then review copies already uploaded.',
    steps: [
      { title: 'iPhone: camera and selected photos', body: 'Open Settings > Privacy & Security > Camera and turn off this app. Under Photos, choose the app and use Limited Access or None where available. Review the selected photos if you still need uploads.' },
      { title: 'Android: narrow the permission', body: 'Open Settings > Apps > this app > Permissions. Set Camera to Don’t allow or Ask every time. For Photos and videos, use selected photos where supported, or remove access. Names vary by Android version.' },
      { title: 'Web: block the camera', body: 'Open the browser’s site controls next to the address, then its permissions or site settings. Block Camera. Choosing a file for upload still sends that file even when camera access is blocked.' },
      { title: 'Remove uploaded copies separately', body: 'Review uploaded photos, face profiles and cloud backups in the app. Delete unwanted copies and use the policy’s deletion process for retained data. Revoking a device permission does not remove existing uploads.' },
    ],
    relevant: /camera|photo|image|facial|face|biometric/,
  },
  EARS: {
    title: 'Take back your voice.',
    intro: 'Stop future microphone access and check what happened to previous recordings.',
    steps: [
      { title: 'iPhone: switch off the microphone', body: 'Open Settings > Privacy & Security > Microphone and turn off this app. Voice calls, recording and voice input may stop working until you allow access again.' },
      { title: 'Android: ask each time', body: 'Open Settings > Apps > this app > Permissions > Microphone. Choose Don’t allow or Ask every time where available. Only while using the app is narrower than continuous access.' },
      { title: 'Web: block microphone permission', body: 'Use the browser’s site controls or site settings to block Microphone. Also end any active recording or call. Review voice activation and recording history controls inside the app.' },
      { title: 'Delete old recordings separately', body: 'Find voice messages, recordings, transcripts and voice profiles in account settings. Delete the copies you can control and use the official deletion process for retained data. Turning off the microphone does not erase them.' },
    ],
    relevant: /microphone|audio|voice|recording|transcript/,
  },
  MOUTH: {
    title: 'Choose what you say.',
    intro: 'Messages and posts often reach the service because you send them. Device permissions cannot undo that.',
    steps: [
      { title: 'iPhone and Android: reduce the audience', body: 'In the app’s privacy or audience settings, review who can see posts, contact you, tag you or discover your profile. Set future posts to the smallest useful audience where those controls exist.' },
      { title: 'Check connected accounts and backups', body: 'Review cross-posting, chat exports, connected services and cloud chat backups. Turn off syncing you do not need. Check encryption and retention information for backups separately from the main chat service.' },
      { title: 'Web: review old content', body: 'Use the service’s account or activity page to review posts and messages. Where available, delete content or use a delete-for-everyone option. Recipients, screenshots and backups may still preserve copies.' },
      { title: 'Use the policy’s deletion route', body: 'Request deletion of retained content or close the account if that is your choice. Saving an export first can preserve your own copy. Account deletion and deleting a post can have different effects and exceptions.' },
    ],
    relevant: /message|chat|post|content|communication|audience/,
  },
  HEAD: {
    title: 'Make the profile smaller.',
    intro: 'Reduce tracking and personalization. Each control covers a different source of activity.',
    steps: [
      { title: 'iPhone: review tracking permission', body: 'Open Settings > Privacy & Security > Tracking and turn off this app’s request to track. This limits covered tracking across other companies’ apps and websites. It does not stop all analytics or activity collected within the app.' },
      { title: 'Android: review ad privacy', body: 'Search Settings for Ads or Ad privacy. Review the advertising ID and available ad-topic controls. Then review personalized ads and activity history in the app’s own account settings. Options vary by device and version.' },
      { title: 'Web: cookies and personalization', body: 'Use the site’s consent controls to reject optional advertising cookies where offered. Review browser controls for third-party cookies, then check the account’s ad personalization and off-site activity settings. A private window does not make you anonymous to a site you sign into.' },
      { title: 'Clear history and opt out separately', body: 'Use available search or activity-history deletion controls. Follow any advertising opt-out or objection process stated in the policy. Clearing local cookies does not itself delete a profile already held by the company.' },
    ],
    relevant: /advertis|profil|tracking|brows|interest|behavio|activity|marketing|opt.out/,
  },
  HEART: {
    title: 'Protect the personal things.',
    intro: 'Health, mood and wellbeing details deserve narrower sharing and a separate deletion review.',
    steps: [
      { title: 'iPhone: review Health sharing', body: 'If the app connects to Apple Health, open Health, tap your profile, and review Apps and Services under Privacy. Select the app and turn off the data categories it can read or write. Menu labels can vary.' },
      { title: 'Android: review Health Connect', body: 'If you use Health Connect, open it from Settings or its app, then review App permissions. Remove the app or limit individual health categories. Also check any separate fitness account or wearable connection.' },
      { title: 'In the app and on the web', body: 'Review health integrations, wearable links, mood journals and public profile visibility. Disconnect sharing you do not need. Information you type into a journal or chat can still be sent without a device health permission.' },
      { title: 'Review past health records', body: 'Delete sensitive entries and use the official privacy contact or deletion process for stored copies. Removing Health access does not erase records the app previously obtained. Keep medical records you need before deleting them.' },
    ],
    relevant: /health|medical|wellbeing|well.being|mood|emotion|fitness/,
  },
  HANDS: {
    title: 'Close the briefcase.',
    intro: 'Stop future contact and file access, then remove cloud copies and connected drives separately.',
    steps: [
      { title: 'iPhone: contacts and file access', body: 'Open Settings > Privacy & Security > Contacts and select the app. Use Limited Access where supported or turn access off. Review Files and Folders permissions if this app is listed. File-picker uploads may have been shared individually.' },
      { title: 'Android: remove broad permissions', body: 'Open Settings > Apps > this app > Permissions and review Contacts, Photos and videos, or Files permissions where listed. If the app has All files access under Special app access, review that separately.' },
      { title: 'Turn off cloud syncing', body: 'Inside the app, turn off contact uploading or address-book syncing if available. Use its separate control to delete uploaded contacts. Disconnect linked cloud drives and revoke integrations in the drive provider’s account settings.' },
      { title: 'Delete uploads already held', body: 'Review and delete documents uploaded to the app, including shared copies and trash where relevant. Removing a device permission or disconnecting a drive does not recall files already copied. Use the policy’s deletion process for retained copies.' },
    ],
    relevant: /contact|address book|file|document|drive|sync/,
  },
  FEET: {
    title: 'Stop leaving a trail.',
    intro: 'Narrow precise and background location, then review location history already stored.',
    steps: [
      { title: 'iPhone: while using and approximate', body: 'Open Settings > Privacy & Security > Location Services > this app. Choose Never, Ask Next Time, or While Using the App as appropriate. Turn off Precise Location if approximate location is enough.' },
      { title: 'Android: avoid background access', body: 'Open Settings > Apps > this app > Permissions > Location. Choose Don’t allow, Ask every time, or Allow only while using the app where offered. Turn off Use precise location if you only need an approximate area.' },
      { title: 'Web: block location requests', body: 'Open the browser’s site controls or site settings and block Location. The service may still estimate an area from your IP address or use locations you type, tag or share.' },
      { title: 'Clear saved trails separately', body: 'Review timeline, location history, saved trips and geotagged posts inside the account. Turn off unwanted history and delete old records where supported. Revoking GPS access does not remove past location data.' },
    ],
    relevant: /location|geolocation|gps|movement|travel|trip|precise/,
  },
  VAULT: {
    title: 'Put a lock on the vault.',
    intro: 'Remove unnecessary payment links while treating subscriptions, purchases and retained records separately.',
    steps: [
      { title: 'Review saved payment methods', body: 'Open the app or website’s billing or payment settings. Remove unused cards and saved payment methods if the service permits it. Removing a card does not cancel a subscription or erase purchase history.' },
      { title: 'iPhone and Android: check subscriptions', body: 'For Apple-billed subscriptions, open Settings > your name > Subscriptions. For Google Play billing, open Play Store > profile > Payments & subscriptions > Subscriptions. Cancel with the actual billing provider; deleting the app does not cancel billing.' },
      { title: 'Web: disconnect financial links', body: 'Review subscriptions bought directly from the service in its web billing settings. If a bank or payment account is linked, disconnect it in the app and review connected-app permissions with the bank or payment provider.' },
      { title: 'Request deletion of retained data', body: 'Use the policy’s deletion process for eligible billing and purchase data. Transaction, tax, fraud-prevention or legal records may have to be retained. Keep receipts you need, and check cancellation terms before removing the account.' },
    ],
    relevant: /payment|bank|card|purchas|billing|transaction|financial/,
  },
});

const FALLBACK = {
  title: 'Take back some control.',
  intro: 'Review the control that matches this finding and follow the app’s official privacy instructions.',
  steps: [
    { title: 'Limit future access', body: 'Review this app’s permissions in iPhone or Android settings. On the web, review the browser’s site permissions and the app’s privacy controls. Menu names and available controls vary.' },
    { title: 'Review connected services', body: 'Disconnect integrations and optional syncing you no longer need. Check audience, activity and personalization settings inside the account.' },
    { title: 'Handle existing copies separately', body: 'Revoking access does not delete information already collected. Use the official privacy policy to find the available access, deletion, objection or account-closure process and its exceptions.' },
  ],
  relevant: /privacy|permission|control/,
};

function safeHttpsUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

function normalizedTarget(item) {
  const raw = String(item?.bodyTarget || item?.target || '').toUpperCase();
  if (raw.includes('BRIEFCASE') || raw.includes('HANDS')) return 'HANDS';
  return Object.keys(TARGETS).find(target => raw === target) || 'UNKNOWN';
}

function relevantRights(record, remedy) {
  const candidates = Array.isArray(record?.sorted?.yourRights) ? record.sorted.yourRights : [];
  return candidates.filter(right => {
    const title = typeof right === 'string' ? right : String(right?.title || right?.name || right?.action || '');
    const text = typeof right === 'string' ? right : [title, right?.description, right?.evidence].filter(Boolean).join(' ');
    // Access, export and deletion rights apply to previously collected data in
    // every category. Category-specific controls are included only when found.
    return /delet|eras|clos.{0,15}account|access.{0,25}(?:information|data)|download|portab|copy of/i.test(title) || remedy.relevant.test(text.toLowerCase());
  });
}

/**
 * Return a fresh, side-effect-free lesson for one actual policy finding.
 * `rights` contains only matching entries from record.sorted.yourRights.
 * `sourceUrl` is an HTTPS link from those entries or record.privacyUrl, or null.
 * A practice animation does not change any real app, device or account setting.
 */
export function getRemedy(item, record) {
  const bodyTarget = normalizedTarget(item);
  const remedy = TARGETS[bodyTarget] || FALLBACK;
  const rights = relevantRights(record, remedy);
  const sourceUrl = rights.map(right => safeHttpsUrl(right?.source?.url || right?.sourceUrl)).find(Boolean) || safeHttpsUrl(record?.privacyUrl);
  return {
    title: remedy.title,
    intro: remedy.intro,
    steps: remedy.steps.map(step => ({ ...step })),
    rights: rights.map(right => typeof right === 'object' && right !== null ? { ...right, ...(right.source ? { source: { ...right.source } } : {}) } : right),
    sourceUrl,
    bodyTarget,
  };
}
