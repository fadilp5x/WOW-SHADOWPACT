// Quiet synthesized cues. Audio starts only after a deliberate user gesture.
export function createAudio() {
 let context, enabled=true;
 try { enabled=localStorage.getItem('shadowpact:sound')!=='off'; } catch {}
 async function unlock(){if(!enabled)return;try {const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;context ||= new Audio();if(context.state==='suspended')await context.resume();}catch{}}
 function tone(start,end,duration,volume=.045,delay=0,type='sine'){
  if(!enabled||!context||context.state!=='running')return;
  const now=context.currentTime+delay,osc=context.createOscillator(),gain=context.createGain();osc.type=type;osc.frequency.setValueAtTime(start,now);osc.frequency.exponentialRampToValueAtTime(end,now+duration);gain.gain.setValueAtTime(.0001,now);gain.gain.exponentialRampToValueAtTime(volume,now+.014);gain.gain.exponentialRampToValueAtTime(.0001,now+duration);osc.connect(gain);gain.connect(context.destination);osc.start(now);osc.stop(now+duration+.02);osc.onended=()=>{osc.disconnect();gain.disconnect();};
 }
 return {get enabled(){return enabled;},unlock,toggle(){enabled=!enabled;try{localStorage.setItem('shadowpact:sound',enabled?'on':'off');}catch{}if(enabled)unlock();return enabled;},catch(){tone(230,72,.18,.055,0,'triangle');tone(900,360,.09,.016,.035);},release(){tone(330,660,.2,.035);tone(660,880,.23,.025,.1);},dispose(){context?.close().catch(()=>{});}};
}
