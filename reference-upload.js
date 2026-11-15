import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from './supabase-config.js';
import {TURNSTILE_SITE_KEY,REFERENCE_UPLOAD_FUNCTION} from './reference-upload-config.js';

const MAX_FILES=3, MAX_FILE_SIZE=3*1024*1024;
const TYPES=new Set(['image/jpeg','image/png','image/webp']);
let files=[],widgetId=null,initPromise=null,previewUrls=[];
const $=id=>document.getElementById(id);
export const selectedReferenceFiles=()=>files.slice();
const clearPreviews=()=>{for(const url of previewUrls)URL.revokeObjectURL(url);previewUrls=[];};
function renderPreviews(){
 clearPreviews();const root=$('reference-previews');root.replaceChildren();
 files.forEach((file,index)=>{
  const card=document.createElement('div');card.className='reference-preview';
  const img=document.createElement('img');const url=URL.createObjectURL(file);previewUrls.push(url);img.src=url;img.alt='Reference image '+(index+1);img.loading='lazy';
  const name=document.createElement('span');name.textContent=file.name;name.title=file.name;
  const remove=document.createElement('button');remove.type='button';remove.className='reference-remove';remove.textContent='Remove';remove.setAttribute('aria-label','Remove '+file.name);
  remove.addEventListener('click',()=>{files.splice(index,1);renderPreviews();});
  card.append(img,name,remove);root.append(card);
 });
 $('reference-count').textContent=files.length?files.length+' of 3 selected':'No images selected';
 $('turnstile-wrap').hidden=!files.length;
}
export function setupReferenceImages(){
 const input=$('reference-files');
 input.addEventListener('change',()=>{
  const next=[...input.files];input.value='';
  if(!next.length)return;
  if(files.length+next.length>MAX_FILES){$('reference-error').textContent='Select a maximum of 3 reference images.';return;}
  for(const file of next){
   if(!TYPES.has(file.type)||file.size===0||file.size>MAX_FILE_SIZE){
    $('reference-error').textContent='Use JPG, PNG or WebP files up to 3 MB each.';return;
   }
  }
  $('reference-error').textContent='';files.push(...next);renderPreviews();if(files.length)void initTurnstile();
 });
 renderPreviews();
}
export function referenceReviewLabel(){return files.length?files.length+' image(s): '+files.map(f=>f.name).join(', '):'None';}
export function referenceUploadReady(){return Boolean(TURNSTILE_SITE_KEY&&SUPABASE_URL&&SUPABASE_PUBLISHABLE_KEY);}
function loadTurnstile(){
 if(window.turnstile)return Promise.resolve();
 if(initPromise)return initPromise;
 initPromise=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src='https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit';script.async=true;script.defer=true;
  script.onload=()=>{if(window.turnstile)resolve();else reject(Error('Verification widget did not load.'));};
  script.onerror=()=>reject(Error('Verification widget could not load.'));document.head.append(script);
 }).catch(e=>{initPromise=null;throw e;});
 return initPromise;
}
async function initTurnstile(){
 if(!referenceUploadReady()){
  $('reference-error').textContent='Reference uploads are being configured. You can still send a request without images.';
  return;
 }
 try{
  await loadTurnstile();
  if(widgetId===null)widgetId=window.turnstile.render('#turnstile-widget',{sitekey:TURNSTILE_SITE_KEY,theme:'auto'});
 }catch{$('reference-error').textContent='Could not load image-upload verification. Check your connection and retry.';}
}
export async function uploadReferenceImages(){
 if(!files.length)return null;
 if(!referenceUploadReady())throw Error('Reference image uploads are not enabled yet. Remove the images or contact SteveCraft directly.');
 await initTurnstile();
 const token=widgetId!==null?window.turnstile.getResponse(widgetId):'';
 if(!token)throw Error('Please complete the image-upload security check before continuing.');
 const body=new FormData();body.append('captchaToken',token);
 for(const file of files)body.append('images',file,file.name);
 const response=await fetch(SUPABASE_URL.replace(/\/$/,'')+'/functions/v1/'+REFERENCE_UPLOAD_FUNCTION,{
  method:'POST',headers:{apikey:SUPABASE_PUBLISHABLE_KEY},body
 });
 let data={};try{data=await response.json();}catch{}
 if(widgetId!==null)window.turnstile.reset(widgetId);
 if(!response.ok||!data.referenceId||data.count!==files.length)throw Error(data.error||'The images could not be uploaded. Please try again.');
 return {referenceId:data.referenceId,count:data.count};
}
