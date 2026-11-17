// Runtime configuration lives here. The TinyFish credential is a server secret.
// Never ship a TinyFish API key in browser JavaScript.
export const CONFIG = Object.freeze({
  searchEndpoint: 'https://api.search.tinyfish.ai',
  extractEndpoint: 'https://api.fetch.tinyfish.ai',
  apiKeyBinding: 'TINYFISH_API_KEY',
  requestTimeoutMs: 65000,
});

// Paste a Firebase web configuration here, or set the FIREBASE_CONFIG runtime
// variable to its JSON value. Server writes require a Firebase service account
// or a trusted shadowpactServer token. These public identifiers are not secrets.
export const FIREBASE_CONFIG = Object.freeze({
  apiKey: '',
  authDomain: '',
  projectId: '',
  storageBucket: '',
  messagingSenderId: '',
  appId: '',
});

const categoryRules = [
  { category: 'Photos & camera', bodyTarget: 'EYES', match: /\b(cameras?|photos?|photographs?|images?|facial|face recognition|biometrics?)\b/i, sensitivity: 10 },
  { category: 'Audio & voice', bodyTarget: 'EARS', match: /\b(microphones?|audio|voices?|sound recordings?)\b/i, sensitivity: 10 },
  { category: 'Messages & posts', bodyTarget: 'MOUTH', match: /\b(messages?|chats?|posts?|communication content)\b/i, sensitivity: 9 },
  { category: 'Browsing & interests', bodyTarget: 'HEAD', match: /\b(browsing|search history|interests?|behavio[u]?r|online activit(?:y|ies)|interactions?|usage information|usage data)\b/i, sensitivity: 8 },
  { category: 'Health & wellbeing', bodyTarget: 'HEART', match: /\b(health|medical|wellbeing|well-being|mood|emotions?)\b/i, sensitivity: 12 },
  { category: 'Contacts & documents', bodyTarget: 'HANDS', match: /\b(contacts|contact lists?|address books?|files|documents)\b/i, sensitivity: 9 },
  { category: 'Location & movement', bodyTarget: 'FEET', match: /\b(locations?|geolocation|gps|movements?|travel)\b/i, sensitivity: 10 },
  { category: 'Payments & purchases', bodyTarget: 'VAULT', match: /\b(payments?|bank accounts?|credit cards?|debit cards?|card details|transactions?|purchases?|billing)\b/i, sensitivity: 10 },
];
const officialDomains = {
  meta: ['meta.com', 'facebook.com'],
  instagram: ['instagram.com', 'meta.com', 'facebook.com'], facebook: ['facebook.com', 'meta.com'],
  whatsapp: ['whatsapp.com'], threads: ['threads.com', 'threads.net', 'instagram.com', 'meta.com'],
  tiktok: ['tiktok.com'], snapchat: ['snap.com', 'snapchat.com'], spotify: ['spotify.com'],
  youtube: ['youtube.com', 'google.com'], google: ['google.com'], gmail: ['google.com'],
  chrome: ['google.com'], 'google maps': ['google.com'], 'google photos': ['google.com'],
  twitter: ['x.com', 'twitter.com'], x: ['x.com', 'twitter.com'], reddit: ['reddit.com', 'redditinc.com'],
  discord: ['discord.com'], telegram: ['telegram.org'], signal: ['signal.org'],
  chatgpt: ['chatgpt.com', 'openai.com'], openai: ['openai.com'], claude: ['anthropic.com'],
  notion: ['notion.so', 'notion.com'], slack: ['slack.com', 'salesforce.com'],
  zoom: ['zoom.com', 'zoom.us'], linkedin: ['linkedin.com'], pinterest: ['pinterest.com'],
  uber: ['uber.com'], amazon: ['amazon.com'], netflix: ['netflix.com'],
  duolingo: ['duolingo.com'], dropbox: ['dropbox.com'], strava: ['strava.com'],
};
const collectionVerb = /\b(collect|collected|collecting|receive|received|obtain|obtained|access|process|processed|store|stored|record|upload|use|uses|using|share|disclose|retain|provide|provided|includes?)\b/i;
const negativeCollection = /\b(?:do not|does not|don['’]t|doesn['’]t|never|will not|may not|might not|shall not|would not|should not|could not|won['’]t|cannot|can['’]t|no longer)\s+(?:\w+\s+){0,3}(?:collect|receive|obtain|access|process|store|record|upload|use|share|sell|retain)\b/i;
const collectionHeading = /(?:information|data|content).{0,45}(?:collect|provide|receive|upload)|(?:collect|provide|receive).{0,45}(?:information|data|content)/i;
const invalidPolicy = /(?:access denied|enable javascript and cookies to continue|verify you are human|sorry.{0,20}page.{0,20}available|log in to continue)/i;
const tokenCache = new Map();
const inflight = new Map();

class ApiError extends Error {
  constructor(message, status = 502, code = 'ANALYSIS_FAILED') { super(message); this.status = status; this.code = code; }
}
function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}
function firebaseConfig(env) {
  try {
    const service = env.FIREBASE_SERVICE_ACCOUNT ? JSON.parse(env.FIREBASE_SERVICE_ACCOUNT) : null;
    return { ...FIREBASE_CONFIG, ...(env.FIREBASE_CONFIG ? JSON.parse(env.FIREBASE_CONFIG) : {}), ...(env.FIREBASE_PROJECT_ID ? { projectId: env.FIREBASE_PROJECT_ID } : {}), ...(env.FIREBASE_API_KEY ? { apiKey: env.FIREBASE_API_KEY } : {}), ...(service?.project_id ? { projectId: service.project_id } : {}), serverAccess: !!(service || env.FIREBASE_AUTH_TOKEN) };
  }
  catch { throw new ApiError('The Firebase configuration is not valid JSON.', 503, 'FIREBASE_CONFIG_INVALID'); }
}
function firebaseConfigured(config) { return !!(config.projectId && (config.apiKey || config.serverAccess)); }
function cacheId(name) { return encodeURIComponent(name.trim().toLowerCase().replace(/\s+/g, ' ')); }
function isDomain(host, domain) { return host === domain || host.endsWith('.' + domain); }
const domainNames = {
  'instagram.com': 'Instagram', 'facebook.com': 'Facebook', 'meta.com': 'Meta',
  'whatsapp.com': 'WhatsApp', 'threads.com': 'Threads', 'threads.net': 'Threads',
  'tiktok.com': 'TikTok', 'snap.com': 'Snapchat', 'snapchat.com': 'Snapchat',
  'spotify.com': 'Spotify', 'youtube.com': 'YouTube', 'google.com': 'Google',
  'twitter.com': 'X', 'x.com': 'X', 'reddit.com': 'Reddit', 'redditinc.com': 'Reddit',
  'discord.com': 'Discord', 'telegram.org': 'Telegram', 'signal.org': 'Signal',
  'chatgpt.com': 'ChatGPT', 'openai.com': 'ChatGPT', 'anthropic.com': 'Claude', 'notion.so': 'Notion',
  'notion.com': 'Notion', 'slack.com': 'Slack', 'zoom.com': 'Zoom', 'zoom.us': 'Zoom',
  'linkedin.com': 'LinkedIn', 'pinterest.com': 'Pinterest', 'uber.com': 'Uber',
  'amazon.com': 'Amazon', 'netflix.com': 'Netflix', 'duolingo.com': 'Duolingo',
  'dropbox.com': 'Dropbox', 'strava.com': 'Strava',
};
export function normalizeAppInput(value) {
  const input = typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
  const invalid = () => new ApiError('Enter an app name or a public website, such as Instagram or instagram.com.', 400, 'INVALID_APP_NAME');
  if (!input || input.length > 2048 || /[<>\n\r{}\\]/.test(input)) throw invalid();
  if (/[.:/@\[\]]/.test(input)) {
    let url;
    try { url = new URL(/^[a-z][a-z0-9+.-]*:/i.test(input) ? input : 'https://' + input); } catch { throw invalid(); }
    const host = url.hostname.toLowerCase().replace(/\.$/, '').replace(/^www\./, '');
    if (!['https:', 'http:'].includes(url.protocol) || url.username || url.password || url.port || host.length > 253 || !/^(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z][a-z0-9-]{1,62}$/.test(host) || /(?:^|\.)(?:localhost|local|internal|lan|home|test|invalid|example)$/.test(host)) throw invalid();
    const known = Object.entries(domainNames).find(([domain]) => isDomain(host, domain));
    return known ? { appName: known[1], officialHost: null } : { appName: host, officialHost: host };
  }
  if (input.length > 80 || /^(?:localhost|local|internal)$/i.test(input)) throw invalid();
  const name = input.toLowerCase();
  const canonical = Object.values(domainNames).find(item => item.toLowerCase() === name);
  return { appName: canonical || (name === 'twitter' ? 'X' : input), officialHost: null };
}
function officialUrl(value, appName, officialHost = null) {
  try {
    const url = new URL(value); if (url.protocol !== 'https:' || url.username || url.password || url.port) return false;
    const host = url.hostname.toLowerCase();
    if (officialHost) return isDomain(host, officialHost);
    const domains = officialDomains[appName.toLowerCase()];
    if (domains) return domains.some(domain => isDomain(host, domain));
    const slug = appName.toLowerCase().replace(/[^a-z0-9]/g, '');
    // Unknown apps must have a matching brand domain. Never accept reviews or
    // third-party policy summaries as the app's official terms.
    return slug.length > 2 && host.split('.').some(part => part === slug) && !/\.(?:blogspot|wordpress|medium)\./.test(host);
  } catch { return false; }
}

async function tinyfish(url, options, env) {
  const key = env[CONFIG.apiKeyBinding];
  if (!key) throw new ApiError('Policy search is not connected. Set the server TINYFISH_API_KEY to enable live analysis.', 503, 'TINYFISH_NOT_CONFIGURED');
  let response;
  try {
    response = await fetch(url, { ...options, headers: { 'X-API-Key': key, ...(options?.body ? { 'content-type': 'application/json' } : {}), ...options?.headers }, signal: AbortSignal.timeout(CONFIG.requestTimeoutMs) });
  } catch { throw new ApiError('Policy search took too long to respond. Please try again.', 504, 'TINYFISH_TIMEOUT'); }
  if (!response.ok) {
    const messages = {
      401: 'The TinyFish API key was rejected. Check the server key and try again.',
      402: 'TinyFish has reached its current allowance. Try again after its allowance resets.',
      403: 'TinyFish could not access this request. Please try a different app.',
      429: 'TinyFish is busy with too many requests. Wait a moment and try again.',
    };
    throw new ApiError(messages[response.status] || 'The policy search service is temporarily unavailable. Please try again.', response.status === 429 ? 429 : 502, 'TINYFISH_' + response.status);
  }
  return response.json();
}
async function searchPolicy(appName, kind, env, officialHost) {
  const query = new URLSearchParams({ query: `${appName} official ${kind === 'privacy' ? 'privacy policy' : 'terms of service terms of use'}`, language: 'en', purpose: `Find the current official ${kind} policy published by ${appName}. Exclude articles, old versions and third-party summaries.` });
  if (officialHost) query.set('include_domains', officialHost);
  const result = await tinyfish(CONFIG.searchEndpoint + '?' + query, {}, env);
  const words = kind === 'privacy' ? /privacy|data policy/i : /terms|conditions|user agreement/i;
  const found = (result.results || []).filter(item => officialUrl(item.url, appName, officialHost) && words.test(item.title + ' ' + item.url) && !/before-|archiv|previous|\/version\/|\b201[0-9]\b|\.pdf(?:\?|$)/i.test(item.url))
    .map(item => ({ ...item, score: (words.test(item.title) ? 6 : 0) + (words.test(new URL(item.url).pathname) ? 4 : 0) - (item.position || 1) / 10 }))
    .sort((a, b) => b.score - a.score).slice(0, 3);
  // Verified canonical Meta destination. Search still runs first; this avoids
  // the legacy Instagram redirect being mistaken for an unreadable policy.
  if (kind === 'privacy' && appName.toLowerCase() === 'instagram') found.unshift({ url: 'https://privacycenter.instagram.com/policy', title: 'Meta Privacy Policy' });
  return found.slice(0, 3);
}
function policyUsable(result, kind) {
  const text = result?.text;
  if (typeof text !== 'string' || text.length < 1600) return false;
  if (invalidPolicy.test(text.slice(0, 1200)) && text.length < 5000) return false;
  const firstHeading = text.match(/^#\s+(.+)$/m)?.[1] || result.title || '';
  if (kind === 'privacy' && /terms of (?:use|service)|user agreement/i.test(firstHeading)) return false;
  if (kind === 'terms' && /privacy policy|data policy/i.test(firstHeading)) return false;
  return kind === 'privacy' ? /personal (?:information|data)|information we collect|privacy policy/i.test(text) : /terms|agreement|conditions|liability|license/i.test(text);
}
async function findPolicies(appName, env, officialHost, progress) {
  progress('search', 'Finding the official privacy policy and terms.', 'running');
  const [privacyResults, termsResults] = await Promise.all([searchPolicy(appName, 'privacy', env, officialHost), searchPolicy(appName, 'terms', env, officialHost)]);
  if (!privacyResults.length || !termsResults.length) throw new ApiError(`We could not verify both official policies for ${appName}. Try the app's full name. No analysis has been invented.`, 404, 'OFFICIAL_POLICIES_NOT_FOUND');
  progress('search', 'Found official policy sources.', 'complete');
  const urls = [...new Set([...privacyResults, ...termsResults].map(item => item.url))];
  progress('extract', 'Reading the official policy pages.', 'running');
  const extracted = await tinyfish(CONFIG.extractEndpoint, { method: 'POST', body: JSON.stringify({ urls, format: 'markdown', links: true, page_metadata: true, ttl: 86400, per_url_timeout_ms: 45000, purpose: `Extract the complete official Privacy Policy and Terms of Service for ${appName}, retaining all policy sections and verbatim clauses.` }) }, env);
  const results = extracted.results || [];
  function select(candidates, kind) {
    for (const candidate of candidates) {
      const result = results.find(item => item.url === candidate.url);
      if (policyUsable(result, kind) && officialUrl(result.final_url || result.url, appName, officialHost)) return { title: kind === 'privacy' ? 'Privacy Policy' : 'Terms of Service', url: result.final_url || candidate.url, text: result.text, fetchedTitle: result.title || candidate.title };
    }
    return null;
  }
  const privacy = select(privacyResults, 'privacy'), terms = select(termsResults, 'terms');
  if (!privacy || !terms) throw new ApiError(`The official ${!privacy ? 'privacy policy' : 'terms'} for ${appName} could not be fully read. The page may block automated access. Try again later or try another app.`, 422, 'POLICY_UNREADABLE');
  progress('extract', 'Both policies have been read.', 'complete');
  return [privacy, terms];
}

function splitEvidence(doc) {
  let section = doc.title;
  let inventoryContext = false;
  const items = [];
  for (const block of doc.text.split(/\n\s*\n|\n(?=\s*[-*•]\s)/)) {
    const trimmed = block.trim(); if (!trimmed) continue;
    if (/^#{1,6}\s/.test(trimmed)) {
      const heading = trimmed.replace(/^#+\s*/, '').replace(/\*\*/g, '').slice(0, 180);
      if (!/^Highlights$/i.test(heading)) { section = heading; inventoryContext = collectionHeading.test(section); }
      continue;
    }
    if (trimmed.length < 150 && /^[^.!?]+\?$/.test(trimmed)) { section = trimmed; inventoryContext = collectionHeading.test(section); continue; }
    if (/information categories we use|here.s the information we collect|(?:information|data).{0,80}(?:could include|includes?).{0,30}following/i.test(trimmed)) inventoryContext = true;
    const inventory = collectionHeading.test(section) || (inventoryContext && /^[-*•]\s/.test(trimmed));
    const sentences = trimmed.match(/[^.!?]+(?:[.!?](?=\s|$)|$)/g) || [trimmed];
    for (const sentence of sentences) {
      const text = sentence.replace(/^[\s>*•-]+/, '').trim();
      if (text.length < (inventory ? 20 : 35) || text.length > 1800 || text.endsWith('?')) continue;
      items.push({ text, source: { url: doc.url, title: doc.title, section }, inventory });
    }
  }
  return items;
}
function affirmativeParts(item) {
  return item.text.split(/\s+(?:but|however|whereas)\s+|;/i).filter(clause => !negativeCollection.test(clause));
}
function evidenceScore(item, rule) {
  const clauses = affirmativeParts(item);
  const match = clauses.find(clause => rule.match.test(clause) && ((collectionVerb.test(clause) && /\b(?:we|us|our|company|partners|information|data|includes?)\b/i.test(clause)) || item.inventory));
  if (!match) return -1;
  if (/\b(prohibited|prohibit|must not|you may delete|you can delete|right to delete|right to access|do not upload)\b/i.test(match)) return -1;
  if (rule.bodyTarget === 'HEART' && /well.being of (?:our|the) community|public health|health and safety|healthy (?:community|environment)/i.test(match) && !/health (?:information|data)|medical (?:information|data)/i.test(match)) return -1;
  if (/\b(?:you use|use of) (?:our )?(?:payment|purchase) features/i.test(match) && !/collect|receive|store|transaction (?:data|information)|payment (?:data|information)/i.test(match)) return -1;
  const matchAt = match.search(rule.match);
  // A negative reference later in a mixed inventory must not implicate that category.
  if (/\b(?:not|never|without)\b.{0,55}$/i.test(match.slice(Math.max(0, matchAt - 75), matchAt))) return -1;
  return (item.source.title === 'Privacy Policy' ? 8 : 0) + (item.inventory ? 6 : 0) + (/\bwe (?:may )?(?:collect|receive|use|obtain|store)/i.test(match) ? 5 : 0) + (/\byour\b/i.test(match) ? 2 : 0) - Math.max(0, item.text.length - 250) / 160;
}
const shareRules = [
  { name: 'Advertisers', match: /\b(advertisers?|advertising partners?|advertising companies)\b/i, weight: 7, translation: 'Information can reach advertising companies or partners.' },
  { name: 'Partners & service providers', match: /\b(service providers?|business partners?|vendors?|affiliates|processors|third.part(?:y|ies))\b/i, weight: 4, translation: 'Information can reach outside companies that support or partner with the service.' },
  { name: 'Data brokers', match: /\b(data brokers?|data resellers?)\b/i, weight: 9, translation: 'Information can reach companies that trade in personal data.' },
  { name: 'Authorities', match: /\b(law enforcement|government|authorities|legal process|court order|subpoena)\b/i, weight: 2, translation: 'Information may be disclosed to authorities in the circumstances described here.' },
];
function harshness(text) {
  if (negativeCollection.test(text) || /\b(?:you can|you may|right to) (?:opt out|delete|withdraw)\b/i.test(text)) return 0;
  if (/\b(must not|may not|not allowed|you can['’]t|you cannot|prohibited|prohibit)\b/i.test(text)) return 0;
  if (/\b(?:we retain all rights|our (?:content|intellectual property)|we grant you|we grant to you)\b/i.test(text)) return 0;
  if (!/\b(?:information|data|your content|content you|content that|license|licence|advertis\w*|profiling)\b/i.test(text)) return 0;
  if (/\byou (?:sell|buy|purchase).{0,50}(?:Marketplace|furniture|products?|goods)/i.test(text)) return 0;
  if (/\b(?:we explain|learn more|we want you to understand|this privacy policy)\b/i.test(text)) return 0;
  let score = 0;
  for (const [regex, weight] of [[/perpetual|irrevocable|indefinitely/i, 12], [/sublicen[cs]|transferable|worldwide|royalty.free/i, 9], [/sell|sale of|data brokers?/i, 10], [/advertis|profiling|across.{0,30}(?:websites|apps)/i, 6], [/share|disclose|third.part/i, 4], [/retain|retention|as long as|legal obligation/i, 4], [/merger|acquisition|business transfer/i, 5]]) if (regex.test(text)) score += weight;
  return score;
}
function translateClause(text) {
  if (/perpetual|irrevocable|sublicen[cs]|royalty.free|worldwide/i.test(text)) return 'This grants broad rights over the content described in the clause. Check which rights survive deletion.';
  if (/merger|acquisition|business transfer|(?:sell|transfer).{0,45}(?:our business|business to)/i.test(text)) return 'Your information may move to another business if ownership changes.';
  if (/sell|sale of|data broker/i.test(text)) return 'The clause allows a form of data sale or transfer under the conditions it describes.';
  if (/merger|acquisition|business transfer/i.test(text)) return 'Your information may move to another business if ownership changes.';
  if (/advertis|profiling/i.test(text)) return 'Information about you can support advertising or a profile of your interests.';
  if (/retain|retention|as long as|indefinitely/i.test(text)) return 'Some information can remain stored for the purposes or period described here.';
  if (/law enforcement|legal obligation|authorities|court/i.test(text)) return 'The company may disclose information to meet legal or government requirements.';
  return 'The clause permits information to be used or disclosed in the circumstances described above.';
}
function retentionTranslation(text) {
  const duration = text.match(/\b(?:\d+|one|two|three|four|five|six|seven|eight|nine|ten|thirty|ninety)\s+(?:days?|months?|years?)\b/i);
  if (duration) return `The policy specifies ${duration[0]} for the records described in this clause. Other records may have different periods.`;
  if (/as long as|necessary|needed|reasonably/i.test(text)) return 'There is no single fixed deadline in this clause. Storage lasts as long as the stated purposes or legal duties require.';
  if (/delet|account/i.test(text)) return 'Deletion or account status affects retention, subject to the exceptions in the policy.';
  return 'Retention depends on the circumstances described in this clause.';
}

export function sortPolicies(documents) {
  const evidence = documents.flatMap(splitEvidence);
  const collectionEvidence = evidence.filter(item => item.source.title === 'Privacy Policy');
  const takes = categoryRules.flatMap(rule => {
    const match = collectionEvidence.map(item => ({ item, score: evidenceScore(item, rule) })).filter(item => item.score >= 0).sort((a, b) => b.score - a.score)[0];
    return match ? [{ category: rule.category, bodyTarget: rule.bodyTarget, evidence: match.item.text, source: match.item.source, sensitivity: rule.sensitivity }] : [];
  });
  const sharesWith = shareRules.flatMap(rule => {
    const item = evidence.find(item => affirmativeParts(item).some(clause => {
      const recipientAt = clause.search(rule.match);
      return recipientAt >= 0 && (/\b(?:share|disclose|transfer|send|sell)\b.{0,160}\b(?:with|to)\b/i.test(clause) || /\b(?:receive|access)\b.{0,50}\b(?:information|data)\b/i.test(clause.slice(recipientAt)));
    }) && !/\byou (?:may|can) (?:share|send)|section of.{0,40}(?:Privacy Policy|policy)|learn more/i.test(item.text));
    return item ? [{ name: rule.name, description: rule.translation, evidence: item.text, source: item.source, weight: rule.weight }] : [];
  });
  const retentionEvidence = evidence.filter(item => /\b(retain|retention|keep|kept|store|stored)\b/i.test(item.text) && /\b(as long as|period|necessary|needed|days?|months?|years?|delet|duration|indefinitely)\b/i.test(item.text) && !/retain.{0,20}rights|our content/i.test(item.text)).sort((a,b) => (/retention|how long/i.test(b.source.section) ? 1 : 0) - (/retention|how long/i.test(a.source.section) ? 1 : 0)).slice(0, 3);
  const retention = retentionEvidence.length ? { summary: retentionTranslation(retentionEvidence[0].text), evidence: retentionEvidence.map(item => ({ quote: item.text, source: item.source })) } : { summary: 'No clear retention period was found in the extracted policy text. Check the official policy before assuming a deadline.', evidence: [] };
  const harsh = evidence.map(item => ({ ...item, severity: harshness(item.text) })).filter(item => item.severity > 0 && item.text.length < 750 && !/[\u2014]/.test(item.text)).sort((a, b) => b.severity - a.severity);
  const unique = new Set();
  const worstLines = harsh.filter(item => { const key = item.text.toLowerCase().replace(/\W/g, '').slice(0,120); if (unique.has(key)) return false; unique.add(key); return true; }).slice(0, 5).map(item => ({ quote: item.text, translation: translateClause(item.text), source: item.source, severity: item.severity }));
  const rightsRules = [
    { title: 'Opt out of targeted advertising', match: /\b(opt.out|object|withdraw consent).{0,160}(?:advertis|profiling|marketing)|(?:advertis|marketing).{0,160}(?:opt.out|object|withdraw)/i, text: 'Use the advertising or privacy controls described in the policy. Availability can depend on your location.' },
    { title: 'Request deletion of your data', match: /(?:right|request|you can|you may).{0,130}(?:delet|eras)|(?:deletion|erasure).{0,100}(?:request|right)/i, text: 'Submit a deletion request using the privacy contact or control linked in the official policy. Exceptions may apply.' },
    { title: 'Delete your account', match: /(?:delet|clos).{0,65}account|account.{0,65}(?:deletion|closure)/i, text: 'Follow the account deletion process described in the policy. Account deletion may not remove every retained record.' },
    { title: 'Access or download your information', match: /(?:right|request|you can|you may).{0,100}(?:access|portab|download|copy of).{0,70}(?:information|data)|(?:data portability)/i, text: 'Request access or a copy of your information through the process linked in the policy.' },
    { title: 'Manage your permissions', match: /(?:you can|you may|settings|control).{0,120}(?:permissions|location services|camera|microphone|contact syncing)/i, text: 'Review app permissions in your device settings and the controls described in this policy.' },
  ];
  const yourRights = rightsRules.flatMap(rule => { const item = evidence.find(item => rule.match.test(item.text)); return item ? [{ title: rule.title, description: rule.text, evidence: item.text, source: item.source }] : []; });
  const collectionPoints = takes.reduce((sum, item) => sum + item.sensitivity, 0) * 0.8;
  const sharingPoints = Math.min(22, sharesWith.reduce((sum, item) => sum + item.weight, 0));
  const clausePoints = Math.min(15, worstLines.reduce((sum, item) => sum + item.severity, 0) / 7);
  const exposureScore = Math.min(100, Math.round(collectionPoints + sharingPoints + clausePoints));
  return { takes, sharesWith, retention, worstLines, yourRights, exposureScore };
}

function encodeValue(value) {
  if (value === null || value === undefined) return { nullValue: null };
  if (typeof value === 'string') return { stringValue: value };
  if (typeof value === 'boolean') return { booleanValue: value };
  if (typeof value === 'number') return Number.isInteger(value) ? { integerValue: String(value) } : { doubleValue: value };
  if (Array.isArray(value)) return { arrayValue: { values: value.map(encodeValue) } };
  return { mapValue: { fields: Object.fromEntries(Object.entries(value).map(([key, item]) => [key, encodeValue(item)])) } };
}
function decodeValue(value) {
  if ('stringValue' in value) return value.stringValue;
  if ('booleanValue' in value) return value.booleanValue;
  if ('integerValue' in value) return Number(value.integerValue);
  if ('doubleValue' in value) return value.doubleValue;
  if ('timestampValue' in value) return value.timestampValue;
  if ('arrayValue' in value) return (value.arrayValue.values || []).map(decodeValue);
  if ('mapValue' in value) return Object.fromEntries(Object.entries(value.mapValue.fields || {}).map(([key, item]) => [key, decodeValue(item)]));
  return null;
}
async function firebaseToken(config, env) {
  if (env.FIREBASE_AUTH_TOKEN) return env.FIREBASE_AUTH_TOKEN;
  const cached = tokenCache.get(config.projectId);
  if (cached && cached.expires > Date.now()) return cached.token;
  if (env.FIREBASE_SERVICE_ACCOUNT) {
    const service = JSON.parse(env.FIREBASE_SERVICE_ACCOUNT);
    const base64url = value => btoa(String.fromCharCode(...(typeof value === 'string' ? new TextEncoder().encode(value) : value))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
    const now = Math.floor(Date.now() / 1000);
    const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
    const payload = base64url(JSON.stringify({ iss: service.client_email, scope: 'https://www.googleapis.com/auth/datastore', aud: 'https://oauth2.googleapis.com/token', iat: now, exp: now + 3600 }));
    const keyBytes = Uint8Array.from(atob(service.private_key.replace(/-----[^-]+-----/g, '').replace(/\s/g, '')), character => character.charCodeAt(0));
    const key = await crypto.subtle.importKey('pkcs8', keyBytes, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
    const signature = new Uint8Array(await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(header + '.' + payload)));
    const response = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: header + '.' + payload + '.' + base64url(signature) }), signal: AbortSignal.timeout(12000) });
    if (!response.ok) throw new ApiError('Firebase could not authorize the service account. Check its credentials and Firestore permissions.', 503, 'FIREBASE_AUTH_FAILED');
    const result = await response.json(); tokenCache.set(config.projectId, { token: result.access_token, expires: Date.now() + 3200000 }); return result.access_token;
  }
  const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signUp?key=${encodeURIComponent(config.apiKey)}`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ returnSecureToken: true }), signal: AbortSignal.timeout(12000) });
  if (!response.ok) throw new ApiError('Firebase is configured but could not sign in. Enable anonymous authentication or set a valid server FIREBASE_AUTH_TOKEN.', 503, 'FIREBASE_AUTH_FAILED');
  const result = await response.json(); tokenCache.set(config.projectId, { token: result.idToken, expires: Date.now() + 3200000 }); return result.idToken;
}
async function firestoreRead(appName, config, env) {
  const token = await firebaseToken(config, env);
  const url = `https://firestore.googleapis.com/v1/projects/${encodeURIComponent(config.projectId)}/databases/(default)/documents/apps/${cacheId(appName)}`;
  const response = await fetch(url, { headers: { authorization: 'Bearer ' + token }, signal: AbortSignal.timeout(12000) });
  if (response.status === 404) return null;
  if (!response.ok) throw new ApiError('Firebase could not read its apps collection. Check that Firestore is enabled and its rules allow the configured server access.', 503, 'FIREBASE_READ_FAILED');
  const data = await response.json(); const record = decodeValue({ mapValue: { fields: data.fields } });
  return record.sorted && record.privacyUrl && record.termsUrl ? record : null;
}
async function firestoreWrite(record, config, env) {
  const body = JSON.stringify(encodeValue(record).mapValue);
  if (new TextEncoder().encode(body).length > 950000) return { saved: false, reason: 'The full policy text is too large for one Firestore document. This result is cached in this browser instead.' };
  const token = await firebaseToken(config, env);
  const response = await fetch(`https://firestore.googleapis.com/v1/projects/${encodeURIComponent(config.projectId)}/databases/(default)/documents/apps/${cacheId(record.appName)}`, { method: 'PATCH', headers: { authorization: 'Bearer ' + token, 'content-type': 'application/json' }, body, signal: AbortSignal.timeout(12000) });
  return response.ok ? { saved: true } : { saved: false, reason: 'The analysis is complete, but Firebase did not accept the cache write. Check the apps collection rules.' };
}
async function analyze({ appName, officialHost }, env, config, progress) {
  const configured = firebaseConfigured(config);
  if (configured) {
    progress('cache', 'Checking for a saved analysis.', 'running');
    const cached = await firestoreRead(appName, config, env);
    if (cached) { progress('cache', 'Loaded the saved analysis.', 'complete'); return { ...cached, cacheStatus: 'firestore-hit', cacheConfigured: true }; }
    progress('cache', 'No saved analysis found. Starting a live scan.', 'complete');
  } else progress('cache', 'Starting a live scan. Results will be saved in this browser.', 'skipped');
  const docs = await findPolicies(appName, env, officialHost, progress);
  progress('sort', 'Mapping policy evidence to the body.', 'running');
  const sorted = sortPolicies(docs);
  progress('sort', 'Evidence and exposure score are ready.', 'complete');
  const record = { appName, privacyUrl: docs[0].url, termsUrl: docs[1].url, rawText: docs.map(doc => `# ${doc.title}\nSource: ${doc.url}\n\n${doc.text}`).join('\n\n'), sorted, exposureScore: sorted.exposureScore, fetchedAt: new Date().toISOString() };
  if (configured) progress('save', 'Saving the verified analysis.', 'running');
  const saved = configured ? await firestoreWrite(record, config, env) : { saved: false };
  progress('save', saved.saved ? 'Analysis saved.' : 'Analysis is ready to save in this browser.', saved.saved ? 'complete' : 'skipped');
  return { ...record, cacheStatus: saved.saved ? 'firestore-saved' : 'browser', cacheConfigured: configured, ...(saved.reason ? { cacheWarning: saved.reason } : {}), analysisNotes: 'Evidence-based keyword analysis of the extracted policies. The score is a heuristic: collection sensitivity up to 62.4 points, sharing up to 22, and restrictive clauses up to 15. No missing category is proof that the app does not collect it.' };
}

function analysisTask(target, env, config, listener) {
  const id = target.appName.toLowerCase();
  let task = inflight.get(id);
  if (!task) {
    task = { history: [], listeners: new Set(), promise: null };
    inflight.set(id, task);
    if (listener) task.listeners.add(listener);
    const progress = (stage, message, status) => {
      const event = { type: 'progress', stage, message, status };
      task.history.push(event);
      for (const notify of task.listeners) { try { notify(event); } catch { task.listeners.delete(notify); } }
    };
    task.promise = analyze(target, env, config, progress).finally(() => inflight.delete(id));
  } else if (listener) {
    for (const event of task.history) listener(event);
    task.listeners.add(listener);
  }
  return task;
}
function safeError(error) { return { type: 'error', error: error instanceof ApiError ? error.message : 'Something interrupted the policy analysis. Please try again.', code: error.code || 'ANALYSIS_FAILED' }; }
function streamingAnalysis(target, env, config) {
  let task, emit, cancelled = false;
  const encoder = new TextEncoder();
  const body = new ReadableStream({
    start(controller) {
      emit = event => { if (!cancelled) controller.enqueue(encoder.encode(JSON.stringify(event) + '\n')); };
      task = analysisTask(target, env, config, emit);
      task.promise.then(data => emit({ type: 'result', data }), error => emit(safeError(error))).finally(() => {
        task.listeners.delete(emit);
        if (!cancelled) controller.close();
      });
    },
    cancel() { cancelled = true; task?.listeners.delete(emit); },
  });
  return new Response(body, { headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store, no-transform', 'x-content-type-options': 'nosniff' } });
}

export async function handleApi(request, env = {}) {
  const url = new URL(request.url);
  const streaming = url.pathname === '/api/analyze' && (request.headers.get('accept') || '').includes('application/x-ndjson');
  try {
    const config = firebaseConfig(env);
    if (url.pathname === '/api/config') return json({ liveSearchConfigured: !!env[CONFIG.apiKeyBinding], cacheConfigured: firebaseConfigured(config), cacheProvider: firebaseConfigured(config) ? 'firestore' : 'browser' });
    if (url.pathname !== '/api/analyze') return json({ error: 'Not found.' }, 404);
    if (request.method !== 'POST') return json({ error: 'Use POST to analyze an app.' }, 405);
    let payload; try { payload = await request.json(); } catch { throw new ApiError('Enter an app name to continue.', 400, 'INVALID_REQUEST'); }
    const target = normalizeAppInput(payload.appName);
    if (streaming) return streamingAnalysis(target, env, config);
    return json(await analysisTask(target, env, config).promise);
  } catch (error) {
    const safe = safeError(error);
    if (streaming) return new Response(JSON.stringify(safe) + '\n', { status: error.status || 500, headers: { 'content-type': 'application/x-ndjson; charset=utf-8', 'cache-control': 'no-store' } });
    return json({ error: safe.error, code: safe.code }, error.status || 500);
  }
}
