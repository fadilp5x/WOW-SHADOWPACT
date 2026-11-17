import './style.css';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { createScene } from './scene.js';
import { createAudio } from './audio.js';
import { readAnalysisResponse } from './scan-client.js';
import { getRemedy } from './remedies.js';
gsap.registerPlugin(ScrollTrigger);
const $ = s => document.querySelector(s);
const form=$('#app-form'),input=$('#app-name'),button=$('#analyze'),status=$('#form-status'),details=$('#details');
const progress=$('#scan-progress'),loadingLine=$('#loading-line'),dialog=$('#remedy-dialog'),sound=createAudio();
const clean=value=>String(value??'').replace(/\u2014/g,',');
const esc=value=>clean(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const safeUrl=value=>{try{const u=new URL(value);return ['https:','http:'].includes(u.protocol)?u.href:'#';}catch{return '#';}};
const textOf=value=>typeof value==='string'?value:value?.description||value?.text||value?.summary||value?.name||value?.recipient||value?.action||'';
let scene,record,busy=false,releasing=false,config={cacheConfigured:null},ticker,progressHide,fetchController,selectedIndex=-1,sceneFailure;
const released=new Set();
function placeExamples(anchors){
 if(busy||record||input.value.trim())return;
 const width=$('#stage').clientWidth;
 for(const [name,id] of [['boy','boy-examples'],['tycoon','tycoon-examples']]){const el=$('#'+id),point=anchors[name];if(!point)continue;const half=(el.offsetWidth||180)/2,height=el.offsetHeight||105;let x=Math.max(half+14,Math.min(width-half-14,point.x)),y=Math.max(name==='tycoon'?150:195,point.y-25);const formRect=form.getBoundingClientRect(),stageRect=$('#stage').getBoundingClientRect();const formBottom=formRect.bottom-stageRect.top,formLeft=formRect.left-stageRect.left,formRight=formRect.right-stageRect.left;if(x+half>formLeft-12&&x-half<formRight+12&&y-height<formBottom+12){const beside=formRight+16+half;if(name==='tycoon'&&beside+half<width-14)x=beside;else y=Math.max(y,formBottom+height+16);}el.style.left=x+'px';el.style.top=y+'px';}
}
function updateExamples(){document.querySelectorAll('.example-cloud').forEach(el=>el.hidden=busy||!!record||!!input.value.trim());}
const sceneReady=createScene($('#world'),{
 onProgress:score=>{$('#score-value').textContent=Math.round(score);},
 onLanding:(item,index)=>{sound.catch();$('#performance-status').textContent=`Claw ${index+1}: ${clean(item.category)}. ${clean(item.evidence)}`;$('#scan-message').textContent=`${clean(item.category)}: grip ${index+1} of ${record?.sorted.takes.length||0}`;},
 onComplete:()=>finishPerformance(),onSelectClaw:(item,index)=>openRemedy(index),
 onRelease:(item,index,remaining)=>{released.add(index);sound.release();updateReleaseHint(remaining);document.querySelectorAll(`[data-remedy="${index}"]`).forEach(el=>{el.textContent='Review the fix ✓';});},
 onAnchors:placeExamples
}).then(s=>{scene=s;return s;}).catch(error=>{sceneFailure=error;console.error('3D scene could not start',error);$('#world').innerHTML='<p class="fallback-message">The 3D world needs WebGL. Enable hardware acceleration in your browser, then reload.</p>';return null;});
const configReady=fetch('/api/config').then(r=>r.json()).then(v=>config=v).catch(()=>{});
function setStatus(message,isError=false){status.textContent=clean(message);status.classList.toggle('error',isError);}
function cacheKey(name){return 'shadowpact:v1:'+name.toLocaleLowerCase().trim();}
function readBrowserCache(name){try{const value=JSON.parse(localStorage.getItem(cacheKey(name)));return value?.sorted&&Date.now()-Date.parse(value.fetchedAt)<7*86400000?{...value,cacheStatus:'browser'}:null;}catch{return null;}}
function writeBrowserCache(value,alias){try{const encoded=JSON.stringify(value);localStorage.setItem(cacheKey(value.appName),encoded);if(alias&&cacheKey(alias)!==cacheKey(value.appName))localStorage.setItem(cacheKey(alias),encoded);return true;}catch{return false;}}
function setBusy(value){busy=value;button.disabled=value;input.readOnly=value;button.querySelector('span').textContent=value?'READING THE FINE PRINT':'SEE WHAT IT TAKES';updateExamples();}
function startProgress(){
 clearTimeout(progressHide);clearInterval(ticker);progress.hidden=false;progress.classList.remove('is-finished','is-error');loadingLine.hidden=false;form.setAttribute('aria-busy','true');
 document.querySelectorAll('.scan-steps li').forEach(el=>{el.className='';el.removeAttribute('aria-current');el.removeAttribute('title');el.querySelector('span').textContent=String([...el.parentNode.children].indexOf(el)+1).padStart(2,'0');});
 $('#scan-message').textContent='Checking saved scans';$('#scan-elapsed').textContent='0s';const started=performance.now();ticker=setInterval(()=>{$('#scan-elapsed').textContent=Math.floor((performance.now()-started)/1000)+'s';},1000);
 showProgress({stage:'cache',status:'running',message:'Checking saved scans'});
}
function showProgress(event){
 if(event.message)$('#scan-message').textContent=clean(event.message);
 const el=document.querySelector(`[data-stage="${['cache','search','extract','sort','save'].includes(event.stage)?event.stage:'none'}"]`);if(!el)return;
 const state=event.status||'running';el.className='is-'+state;el.title=state==='skipped'?'Not needed for this scan':state==='complete'?'Complete':'In progress';if(state==='running')el.setAttribute('aria-current','step');else el.removeAttribute('aria-current');if(state==='complete')el.querySelector('span').textContent='✓';if(state==='skipped')el.querySelector('span').textContent='·';
}
function endProgress(error=false){clearInterval(ticker);loadingLine.hidden=true;form.removeAttribute('aria-busy');progress.classList.add(error?'is-error':'is-finished');if(error){$('#scan-message').textContent='Scan stopped';return;}$('#scan-message').textContent='Scan complete. Every grip has a source.';progressHide=setTimeout(()=>{progress.hidden=true;if(record)updateReleaseHint(record.sorted.takes.length-released.size);},2400);}
function syncSound(){const el=$('#sound-toggle');el.setAttribute('aria-pressed',String(sound.enabled));el.setAttribute('aria-label',sound.enabled?'Turn sound off':'Turn sound on');el.querySelector('.sound-label').textContent=sound.enabled?'Sound on':'Sound off';el.classList.toggle('muted',!sound.enabled);}
syncSound();$('#sound-toggle').addEventListener('click',()=>{sound.toggle();syncSound();});
input.addEventListener('input',updateExamples);
document.querySelectorAll('[data-app]').forEach(el=>el.addEventListener('click',()=>{if(busy)return;input.value=el.dataset.app;sound.unlock();form.requestSubmit();}));
form.addEventListener('submit',async event=>{
 event.preventDefault();if(busy||releasing)return;
 const name=input.value.trim().replace(/\s+/g,' ');if(!name)return;
 sound.unlock();if(dialog.open)dialog.close();setBusy(true);released.clear();$('#release-hint').hidden=true;details.hidden=true;ScrollTrigger.getAll().forEach(s=>s.kill());
 let displayName=name;try{if(/[./:]/.test(name))displayName=new URL(/^[a-z]+:/i.test(name)?name:'https://'+name).hostname.replace(/^www\./,'');}catch{}$('#title-app').firstChild.textContent=displayName;$('.scene-title').classList.toggle('long',displayName.length>13);$('#title-score').hidden=true;$('#score-value').textContent='0';window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});setStatus('');startProgress();
 try{
  await Promise.all([sceneReady,configReady]);if(!scene)throw new Error('The 3D scene could not start. Enable WebGL and reload to try again.');scene.reset();
  let result=config.cacheConfigured===false?readBrowserCache(name):null;
  if(result){showProgress({stage:'cache',status:'complete',message:'Saved scan found. Preparing the scene.'});['search','extract','sort','save'].forEach(stage=>showProgress({stage,status:'skipped'}));}
  else{fetchController=new AbortController();const timeout=setTimeout(()=>fetchController.abort(),240000);try{const response=await fetch('/api/analyze',{method:'POST',headers:{'Content-Type':'application/json','Accept':'application/x-ndjson'},body:JSON.stringify({appName:name}),signal:fetchController.signal});result=await readAnalysisResponse(response,showProgress);}finally{clearTimeout(timeout);}}
  if(!result.sorted||!Array.isArray(result.sorted.takes))throw new Error('The policy analysis was incomplete. Please try again.');
  record=result;const browserSaved=writeBrowserCache(record,name);if(!browserSaved&&record.cacheStatus==='browser')record.cacheWarning='This analysis is not cached because browser storage is unavailable or full.';if(record.cacheStatus==='firestore-hit')document.querySelectorAll('.scan-steps li:not(.is-complete)').forEach(el=>showProgress({stage:el.dataset.stage,status:'skipped'}));if(browserSaved&&record.cacheStatus==='browser')showProgress({stage:'save',status:'complete',message:'Saved in this browser. Preparing the scene.'});
  renderDetails(record);$('#title-score').hidden=false;$('#title-app').firstChild.textContent=record.appName;$('.scene-title').classList.toggle('long',record.appName.length>13);button.querySelector('span').textContent='FOLLOW THE CLAWS';$('#scan-message').textContent='Watch what each permission reaches.';await scene.play(record.sorted);
 }catch(error){endProgress(true);setBusy(false);setStatus(error.name==='AbortError'?'The source took too long to respond. Try the app again.':error.message,true);}
});
function finishPerformance(){
 if(!record)return;$('#score-value').textContent=record.exposureScore??record.sorted.exposureScore;details.hidden=false;setBusy(false);setStatus('');endProgress();
 $('#world').setAttribute('aria-label',`A boy on the left is connected to a giant computer by ${record.sorted.takes.length} claws. Select a claw or its label to learn how to reduce that access. Exposure score ${record.exposureScore} out of 100.`);
 updateReleaseHint(record.sorted.takes.length);
 if(!matchMedia('(prefers-reduced-motion: reduce)').matches){gsap.utils.toArray('.detail-section .section-head, .take-card, .quote, .detail-list li, .retention-copy').forEach(el=>gsap.from(el,{opacity:0,y:24,duration:.65,ease:'power2.out',scrollTrigger:{trigger:el,start:'top 92%',once:true}}));}ScrollTrigger.refresh();
}
function updateReleaseHint(remaining){
 const total=record?.sorted.takes.length||0;$('#release-hint').hidden=!total||!progress.hidden;
 $('#release-message').textContent=remaining===0?'Every grip released in this lesson. Now use the steps to change your real settings.':released.size?`${released.size} of ${total} grips released in this lesson. Tap another claw to learn its fix.`:'Tap a red claw or its label to learn how to loosen its grip.';
}
function openRemedy(index){
 if(busy||releasing||!record?.sorted.takes[index])return;selectedIndex=index;const item=record.sorted.takes[index],remedy=getRemedy(item,record);
 $('#remedy-target').textContent=`TAKE BACK CONTROL / ${item.bodyTarget==='HANDS'?'HANDS + BRIEFCASE':item.bodyTarget}`;
 $('#remedy-title').textContent=clean(remedy.title);$('#remedy-intro').textContent=clean(remedy.intro);
 $('#remedy-steps').innerHTML=remedy.steps.map(step=>`<li><div><h3>${esc(step.title)}</h3><p>${esc(step.body)}</p></div></li>`).join('');
 $('#remedy-rights').innerHTML=remedy.rights?.length?`<div class="policy-rights"><h3>Controls mentioned in this policy</h3>${remedy.rights.map(right=>`<p>${esc(typeof right==='string'?right:right.title||right.description)}</p>${sourceLink(right,record.privacyUrl)}`).join('')}</div>`:'';
 const source=safeUrl(remedy.sourceUrl);$('#remedy-source').href=source;$('#remedy-source').hidden=source==='#';
 const done=released.has(index);$('#practice-release').disabled=done;$('#practice-release').innerHTML=done?'Released in this lesson ✓':'Practice releasing this claw <span aria-hidden="true">↗</span>';
 dialog.showModal();dialog.scrollTop=0;
}
$('#close-remedy').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();}});
$('#practice-release').addEventListener('click',async()=>{
 if(releasing||selectedIndex<0||released.has(selectedIndex))return;const index=selectedIndex;releasing=true;dialog.close();sound.unlock();setBusy(true);button.querySelector('span').textContent='LOOSENING THE GRIP';window.scrollTo({top:0,behavior:matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
 try{await scene.releaseClaw(index);}finally{releasing=false;setBusy(false);}
});
function sourceLink(item,fallback){const src=item?.source||{};const url=safeUrl(src.url||item?.sourceUrl||fallback);const label=[src.title||'Policy source',src.section].filter(Boolean).join(' / ');return `<a class="source-link" href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)} ↗</a>`;}
function icon(target){const paths={EYES:'M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0',EARS:'M7 8a5 5 0 0 1 10 0c0 4-5 4-5 8a3 3 0 0 1-6 0 M10 8a2 2 0 0 1 4 0c0 2-3 2-3 5',MOUTH:'M3 11c4 1 5-3 9 0 4-3 5 1 9 0-2 6-5 8-9 8s-7-2-9-8Z M3 11h18',HEAD:'M8 21v-5H5V9a7 7 0 0 1 14 0v4l2 3h-4v5 M9 8l3 3 3-3',HEART:'M12 21 3 12a5 5 0 0 1 9-7 5 5 0 0 1 9 7Z',HANDS:'M6 20 3 12c-1-3 2-3 3-1l1 2V5c0-3 3-3 3 0v5-7c0-2 3-2 3 0v7-6c0-2 3-2 3 0v7-4c0-2 3-2 3 0v9l-3 4Z',FEET:'M12 21s8-7 8-13a8 8 0 0 0-16 0c0 6 8 13 8 13Z M15 8a3 3 0 1 1-6 0 3 3 0 0 1 6 0',VAULT:'M3 4h18v16H3Z M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0 M12 8v8 M8 12h8'};return `<svg class="target-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[target]||paths.HEAD}"/></svg>`;}
function heading(n,title,note=''){return `<div class="section-head"><span class="section-index">${n} / THE FINE PRINT</span><div><h2>${title}</h2>${note?`<p>${note}</p>`:''}</div></div>`;}
function renderDetails(data){
 const s=data.sorted;
 const takes=s.takes.map((t,i)=>`<article class="take-card"><div class="card-top"><span class="target">${esc(t.bodyTarget==='HANDS'?'HANDS + BRIEFCASE':t.bodyTarget)}</span>${icon(t.bodyTarget)}</div><h3>${esc(t.category)}</h3><p class="evidence">${esc(t.evidence)}</p>${sourceLink(t,data.privacyUrl)}<button class="remedy-link" type="button" data-remedy="${i}">How to reduce this access ↗</button></article>`).join('');
 const shares=(s.sharesWith||[]).map(x=>`<li><div>${typeof x==='object'&&x.name?`<strong>${esc(x.name)}</strong><br>`:''}${esc(textOf(x))}${typeof x==='object'?sourceLink(x,data.privacyUrl):''}</div></li>`).join('');
 const quotes=(s.worstLines||[]).map(x=>`<article class="quote"><blockquote>“${esc(x.quote||x.clause||x.text)}”</blockquote><p>${esc(x.translation||x.plainEnglish||x.explanation)}</p>${sourceLink(x,data.termsUrl)}</article>`).join('');
 const rights=(s.yourRights||[]).map(x=>`<li><div>${x.title?`<strong>${esc(x.title)}</strong><br>`:''}${esc(textOf(x))}${typeof x==='object'?sourceLink(x,data.privacyUrl):''}</div></li>`).join('');
 const cacheNote=data.cacheWarning || (data.cacheStatus==='firestore-hit'?'Loaded from Firestore.':data.cacheStatus==='firestore-saved'?'Saved to Firestore.':'Stored in this browser. Firestore will activate when a real Firebase project is configured.');
 details.innerHTML=`<section class="detail-section">${heading('01','What it takes.',`${s.takes.length} categories found in ${esc(data.appName)}’s policy. Every claw above points to one of these findings.`)}<div class="take-grid">${takes||'<p>No mapped data collection categories were found in the retrieved text. This does not establish that the app collects no data.</p>'}</div></section>
 <section class="detail-section">${heading('02','Who gets it.')}<ul class="detail-list">${shares||'<li>No sharing recipients could be established from the retrieved text.</li>'}</ul></section>
 <section class="detail-section">${heading('03','How long it keeps it.')}<div class="retention-copy">${esc(textOf(s.retention))}</div><div class="retention-evidence">${(s.retention?.evidence||[]).map(x=>`<p class="evidence">${esc(x.quote)}</p>${sourceLink(x,data.privacyUrl)}`).join('')}</div></section>
 <section class="detail-section worst-section">${heading('04','The worst lines.')}<div class="quotes">${quotes||'<p>No high-impact clauses could be verified from the retrieved text.</p>'}</div></section>
 <section class="detail-section">${heading('05','What you can do.','Choose “How to reduce this access” on a category card, or tap a claw above for a practical lesson. Then use the real app or device settings to make the change.')}<ul class="detail-list rights-list">${rights||'<li>Review the official privacy policy for available controls and contact information.</li>'}</ul></section>
 <section class="score-band"><div class="score-number">${Math.round(data.exposureScore??s.exposureScore)}<small>/100</small></div><div class="score-end"><h2>You tapped yes in 2 seconds.<br>It takes all of this, forever.</h2><p class="method-note">“Forever” is the scene’s metaphor. Actual retention is described above. The exposure score is a heuristic based on detected categories, sensitivity, sharing and clause severity, not a legal assessment. Extraction can miss context or conditional language. Read the linked sources before making a decision.</p><p class="method-note">${esc(cacheNote)} Retrieved ${esc(new Intl.DateTimeFormat('en',{dateStyle:'medium'}).format(new Date(data.fetchedAt)))}.</p><div class="final-controls"><button class="replay" id="replay">Replay the scene ↗</button><a href="${esc(safeUrl(data.privacyUrl))}" target="_blank" rel="noopener noreferrer">Privacy policy ↗</a><a href="${esc(safeUrl(data.termsUrl))}" target="_blank" rel="noopener noreferrer">Terms of service ↗</a></div></div></section>`;
 document.querySelectorAll('[data-remedy]').forEach(el=>el.addEventListener('click',()=>openRemedy(Number(el.dataset.remedy))));
 $('#replay').addEventListener('click',async()=>{if(busy||releasing)return;sound.unlock();window.scrollTo({top:0,behavior:'smooth'});released.clear();document.querySelectorAll('[data-remedy]').forEach(el=>{el.textContent='How to reduce this access ↗';});$('#release-hint').hidden=true;setBusy(true);startProgress();['cache','search','extract','sort','save'].forEach(stage=>showProgress({stage,status:'skipped'}));$('#scan-message').textContent='Replaying the same policy evidence.';scene.reset();await scene.play(record.sorted);});
}
window.addEventListener('pagehide',event=>{if(!event.persisted){fetchController?.abort();clearInterval(ticker);clearTimeout(progressHide);sound.dispose();scene?.dispose();}});
