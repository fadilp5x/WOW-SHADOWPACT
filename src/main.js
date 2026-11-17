import './style.css';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { createScene } from './scene.js';
gsap.registerPlugin(ScrollTrigger);
const $ = s => document.querySelector(s);
const form = $('#app-form'), input = $('#app-name'), button = $('#analyze'), status = $('#form-status'), details = $('#details');
const clean = value => String(value ?? '').replace(/\u2014/g, ',');
const esc = value => clean(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl = value => {try {const u=new URL(value);return ['https:','http:'].includes(u.protocol)?u.href:'#';}catch{return '#';}};
const textOf = value => typeof value === 'string' ? value : value?.description || value?.text || value?.summary || value?.name || value?.recipient || value?.action || '';
let scene, record, busy=false, config={cacheConfigured:false}, ticker, fetchController;
let sceneReady = createScene($('#world'), {
 onProgress:score => {$('#score-value').textContent=Math.round(score);},
 onLanding:(item,index) => {$('#performance-status').textContent=`Claw ${index+1}: ${clean(item.category)}. ${clean(item.evidence)}`;},
 onComplete:() => finishPerformance()
}).then(s => {scene=s;return s;}).catch(error=>{
 console.error('3D scene could not start',error);
 $('#world').innerHTML='<p class="fallback-message">The 3D world needs WebGL. Enable hardware acceleration in your browser, then reload.</p>';
 throw error;
});
const configReady=fetch('/api/config').then(r=>r.json()).then(v=>config=v).catch(()=>{});
function setStatus(message,isError=false){status.textContent=clean(message);status.classList.toggle('error',isError);}
function cacheKey(name){return 'shadowpact:v1:'+name.toLocaleLowerCase().trim();}
function readBrowserCache(name){try{const value=JSON.parse(localStorage.getItem(cacheKey(name)));return value?.sorted&&Date.now()-Date.parse(value.fetchedAt)<7*86400000?{...value,cacheStatus:'browser'}:null;}catch{return null;}}
function writeBrowserCache(value){try{localStorage.setItem(cacheKey(value.appName),JSON.stringify(value));return true;}catch{return false;}}
function setBusy(value){busy=value;button.disabled=value;input.readOnly=value;button.querySelector('span').textContent=value?'READING THE FINE PRINT':'SEE WHAT IT TAKES';}
form.addEventListener('submit',async event=>{
 event.preventDefault();if(busy)return;
 const name=input.value.trim().replace(/\s+/g,' ');if(!name)return;
 setBusy(true);details.hidden=true;ScrollTrigger.getAll().forEach(s=>s.kill());
 $('#title-app').firstChild.textContent=name;
 $('.scene-title').classList.toggle('long',name.length>13);
 $('#title-score').hidden=true;$('#score-value').textContent='0';
 window.scrollTo({top:0,behavior:'smooth'});
 setStatus('Finding the official privacy policy and terms.');
 const messages=['Finding the official privacy policy and terms.','Reading what the app collects and shares.','Tracing each permission back to its source.','Checking the fine print. Some policies take a little longer.'];let step=0;
 ticker=setInterval(()=>{step=Math.min(step+1,messages.length-1);setStatus(messages[step]);},13000);
 try{
  await Promise.all([sceneReady,configReady]);scene.reset();
  let result=!config.cacheConfigured?readBrowserCache(name):null;
  if(!result){
   fetchController=new AbortController();const timeout=setTimeout(()=>fetchController.abort(),240000);
   try{const res=await fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({appName:name}),signal:fetchController.signal});result=await res.json();if(!res.ok||result.error)throw new Error(result.error||'The policy could not be read. Please try again.');}finally{clearTimeout(timeout);}
  }
  if(!result.sorted||!Array.isArray(result.sorted.takes))throw new Error('The policy analysis was incomplete. Please try again.');
  record=result;if(!writeBrowserCache(record)&&record.cacheStatus==='browser')record.cacheWarning='This analysis is not cached because browser storage is unavailable or full.';clearInterval(ticker);setStatus('');
  renderDetails(record);$('#title-score').hidden=false;$('#title-app').firstChild.textContent=record.appName;
  button.querySelector('span').textContent='FOLLOW THE CLAWS';
  await scene.play(record.sorted);
 }catch(error){clearInterval(ticker);setBusy(false);setStatus(error.name==='AbortError'?'The source took too long to respond. Try the app again.':error.message,true);}
});
function finishPerformance(){
 if(!record)return;
 $('#score-value').textContent=record.exposureScore??record.sorted.exposureScore;
 details.hidden=false;setBusy(false);setStatus('');
 $('#world').setAttribute('aria-label',`A boy on the left is connected to the giant computer on the right by ${record.sorted.takes.length} claws, each representing a policy finding. Exposure score ${record.exposureScore} out of 100.`);
 if(!matchMedia('(prefers-reduced-motion: reduce)').matches){gsap.utils.toArray('.detail-section .section-head, .take-card, .quote, .detail-list li, .retention-copy').forEach(el=>gsap.from(el,{opacity:0,y:24,duration:.65,ease:'power2.out',scrollTrigger:{trigger:el,start:'top 92%',once:true}}));}
 ScrollTrigger.refresh();
}
function sourceLink(item,fallback){const src=item?.source||{};const url=safeUrl(src.url||item?.sourceUrl||fallback);const label=[src.title||'Policy source',src.section].filter(Boolean).join(' / ');return `<a class="source-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`;}
function icon(target){const paths={EYES:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',EARS:'M7 8a5 5 0 0 1 10 0c0 4-5 4-5 8a3 3 0 0 1-6 0 M10 8a2 2 0 0 1 4 0c0 2-3 2-3 5',MOUTH:'M3 11c4 1 5-3 9 0 4-3 5 1 9 0-2 6-5 8-9 8s-7-2-9-8Z M3 11h18',HEAD:'M8 21v-5H5V9a7 7 0 0 1 14 0v4l2 3h-4v5 M9 8l3 3 3-3',HEART:'M12 21 3 12a5 5 0 0 1 9-7 5 5 0 0 1 9 7Z',HANDS:'M6 20 3 12c-1-3 2-3 3-1l1 2V5c0-3 3-3 3 0v5-7c0-2 3-2 3 0v7-6c0-2 3-2 3 0v7-4c0-2 3-2 3 0v9l-3 4Z',FEET:'M12 21s8-7 8-13a8 8 0 0 0-16 0c0 6 8 13 8 13Z M15 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0',VAULT:'M3 4h18v16H3Z M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M12 8v8 M8 12h8'};return `<svg class="target-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[target]||paths.HEAD}"/></svg>`;}
function heading(n,title,note=''){return `<div class="section-head"><span class="section-index">${n} / THE FINE PRINT</span><div><h2>${title}</h2>${note?`<p>${note}</p>`:''}</div></div>`;}
function renderDetails(data){
 const s=data.sorted;
 const takes=s.takes.map((t,i)=>`<article class="take-card"><div class="card-top"><span class="target">${esc(t.bodyTarget==='HANDS'?'HANDS + BRIEFCASE':t.bodyTarget)}</span>${icon(t.bodyTarget)}</div><h3>${esc(t.category)}</h3><p class="evidence">${esc(t.evidence)}</p>${sourceLink(t,data.privacyUrl)}</article>`).join('');
 const shares=(s.sharesWith||[]).map(x=>`<li><div>${typeof x==='object'&&x.name?`<strong>${esc(x.name)}</strong><br>`:''}${esc(textOf(x))}${typeof x==='object'?sourceLink(x,data.privacyUrl):''}</div></li>`).join('');
 const quotes=(s.worstLines||[]).map(x=>`<article class="quote"><blockquote>“${esc(x.quote||x.clause||x.text)}”</blockquote><p>${esc(x.translation||x.plainEnglish||x.explanation)}</p>${sourceLink(x,data.termsUrl)}</article>`).join('');
 const rights=(s.yourRights||[]).map(x=>`<li><div>${x.title?`<strong>${esc(x.title)}</strong><br>`:''}${esc(textOf(x))}${typeof x==='object'?sourceLink(x,data.privacyUrl):''}</div></li>`).join('');
 const cacheNote=data.cacheWarning || (data.cacheStatus==='firestore-hit'?'Loaded from Firestore.':data.cacheStatus==='firestore-saved'?'Saved to Firestore.':'Stored in this browser. Firestore will activate when a real Firebase project is configured.');
 details.innerHTML=`<section class="detail-section">${heading('01','What it takes.',`${s.takes.length} categories found in ${esc(data.appName)}’s policy. Every claw above points to one of these findings.`)}<div class="take-grid">${takes||'<p>No mapped data collection categories were found in the retrieved text. This does not establish that the app collects no data.</p>'}</div></section>
 <section class="detail-section">${heading('02','Who gets it.')}<ul class="detail-list">${shares||'<li>No sharing recipients could be established from the retrieved text.</li>'}</ul></section>
 <section class="detail-section">${heading('03','How long it keeps it.')}<div class="retention-copy">${esc(textOf(s.retention))}</div><div class="retention-evidence">${(s.retention?.evidence||[]).map(x=>`<p class="evidence">${esc(x.quote)}</p>${sourceLink(x,data.privacyUrl)}`).join('')}</div></section>
 <section class="detail-section worst-section">${heading('04','The worst lines.')}<div class="quotes">${quotes||'<p>No high-impact clauses could be verified from the retrieved text.</p>'}</div></section>
 <section class="detail-section">${heading('05','What you can do.')}<ul class="detail-list rights-list">${rights||'<li>Review the official privacy policy for available controls and contact information.</li>'}</ul></section>
 <section class="score-band"><div class="score-number">${Math.round(data.exposureScore??s.exposureScore)}<small>/100</small></div><div class="score-end"><h2>You tapped yes in 2 seconds.<br>It takes all of this, forever.</h2><p class="method-note">“Forever” is the scene’s metaphor. Actual retention is described above. The exposure score is a heuristic based on detected categories, sensitivity, sharing and clause severity, not a legal assessment. Extraction can miss context or conditional language. Read the linked sources before making a decision.</p><p class="method-note">${esc(cacheNote)} Retrieved ${esc(new Intl.DateTimeFormat('en',{dateStyle:'medium'}).format(new Date(data.fetchedAt)))}.</p><div class="final-controls"><button class="replay" id="replay">Replay the scene ↗</button><a href="${esc(safeUrl(data.privacyUrl))}" target="_blank" rel="noopener noreferrer">Privacy policy ↗</a><a href="${esc(safeUrl(data.termsUrl))}" target="_blank" rel="noopener noreferrer">Terms of service ↗</a></div></div></section>`;
 $('#replay').addEventListener('click',async()=>{window.scrollTo({top:0,behavior:'smooth'});setBusy(true);scene.reset();await scene.play(record.sorted);});
}
window.addEventListener('pagehide',event=>{if(!event.persisted){fetchController?.abort();clearInterval(ticker);scene?.dispose();}});
