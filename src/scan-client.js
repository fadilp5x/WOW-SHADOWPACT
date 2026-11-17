export async function readAnalysisResponse(response,onProgress=()=>{}) {
 if(!response.headers.get('content-type')?.includes('application/x-ndjson')){
  const result=await response.json();if(!response.ok||result.error)throw new Error(result.error||'The policy could not be read. Please try again.');return result;
 }
 if(!response.body)throw new Error('The scan connection ended before results arrived. Please try again.');
 const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',result;
 function event(line){if(!line.trim())return;let message;try{message=JSON.parse(line);}catch{throw new Error('The scan returned an unreadable update. Please try again.');}
  if(message.type==='error')throw new Error(message.error||'The scan could not finish. Please try again.');
  if(message.type==='progress')onProgress(message);
  if(message.type==='result')result=message.data;
 }
 try{while(true){const {done,value}=await reader.read();buffer+=decoder.decode(value,{stream:!done});const lines=buffer.split('\n');buffer=lines.pop();for(const line of lines)event(line);if(done)break;}if(buffer.trim())event(buffer);if(!result?.sorted)throw new Error('The scan ended before the complete analysis arrived. Please try again.');return result;}catch(error){await reader.cancel().catch(()=>{});throw error;}finally{reader.releaseLock();}
}
