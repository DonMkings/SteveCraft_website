// Supabase Edge Function: deploy with --no-verify-jwt because the public
// browser uses a publishable key, not an auth-user JWT. Turnstile protects this endpoint.
// Required secrets: TURNSTILE_SECRET_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY,
// ALLOWED_ORIGINS (comma-separated, exact origins; include localhost for testing).
import {createClient} from 'npm:@supabase/supabase-js@2';

const BUCKET='design-references', MAX_IMAGES=3, MAX_IMAGE_BYTES=3*1024*1024, MAX_BODY_BYTES=10*1024*1024;
const allowedOrigins=(Deno.env.get('ALLOWED_ORIGINS')||'').split(',').map(s=>s.trim()).filter(Boolean);
function cors(origin:string){return {'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'POST, OPTIONS','Access-Control-Allow-Headers':'apikey, content-type, x-client-info','Vary':'Origin'};}
function response(status:number,data:Record<string,unknown>,origin:string){return new Response(JSON.stringify(data),{status,headers:{...cors(origin),'Content-Type':'application/json','Cache-Control':'no-store'}});}
function extension(bytes:Uint8Array,mime:string){
 if(mime==='image/jpeg'&&bytes[0]===255&&bytes[1]===216&&bytes[2]===255)return 'jpg';
 if(mime==='image/png'&&bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71&&bytes[4]===13&&bytes[5]===10)return 'png';
 if(mime==='image/webp'&&new TextDecoder().decode(bytes.slice(0,4))==='RIFF'&&new TextDecoder().decode(bytes.slice(8,12))==='WEBP')return 'webp';
 return null;
}
Deno.serve(async request=>{
 const origin=request.headers.get('origin')||'';
 if(!origin||!allowedOrigins.includes(origin))return response(403,{error:'Origin not permitted.'},origin);
 if(request.method==='OPTIONS')return new Response(null,{status:204,headers:cors(origin)});
 if(request.method!=='POST')return response(405,{error:'Method not allowed.'},origin);
 const secret=Deno.env.get('TURNSTILE_SECRET_KEY');
 const serviceKey=Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
 const projectUrl=Deno.env.get('SUPABASE_URL');
 if(!secret||!serviceKey||!projectUrl)return response(503,{error:'Uploads are not configured.'},origin);
 if(Number(request.headers.get('content-length')||0)>MAX_BODY_BYTES)return response(413,{error:'Upload too large.'},origin);
 try{
  const form=await request.formData();
  const token=form.get('captchaToken');
  const images=form.getAll('images');
  if(typeof token!=='string'||token.length<10)return response(400,{error:'Complete the security check.'},origin);
  if(!images.length||images.length>MAX_IMAGES||images.some(x=>!(x instanceof File)))return response(400,{error:'Choose 1 to 3 images.'},origin);
  const ip=request.headers.get('cf-connecting-ip')||'';
  const verification=new FormData();verification.set('secret',secret);verification.set('response',token);
  if(ip)verification.set('remoteip',ip);
  const challenge=await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify',{method:'POST',body:verification});
  if(!challenge.ok)return response(503,{error:'Security verification is unavailable. Try again.'},origin);
  const result=await challenge.json();
  if(result.success!==true)return response(403,{error:'Security check failed or expired. Try again.'},origin);
  const validated:{bytes:Uint8Array,mime:string,ext:string}[]=[];
  for(const value of images){
   const file=value as File;
   if(file.size<12||file.size>MAX_IMAGE_BYTES)return response(400,{error:'Images must be JPG, PNG or WebP and no larger than 3 MB.'},origin);
   const bytes=new Uint8Array(await file.arrayBuffer());
   const ext=extension(bytes.slice(0,16),file.type);
   if(!ext)return response(400,{error:'An unsupported image format was selected.'},origin);
   validated.push({bytes,mime:file.type,ext});
  }
  const supabase=createClient(projectUrl,serviceKey,{auth:{autoRefreshToken:false,persistSession:false}});
  const referenceId=crypto.randomUUID();
  const uploaded:string[]=[];
  for(const [index,file] of validated.entries()){
   const path=`${referenceId}/${index+1}.${file.ext}`;
   const {error}=await supabase.storage.from(BUCKET).upload(path,file.bytes,{contentType:file.mime,upsert:false,cacheControl:'0'});
   if(error){
    await Promise.all(uploaded.map(path=>supabase.storage.from(BUCKET).remove([path])));
    return response(503,{error:'Could not save the reference images. Please retry.'},origin);
   }
   uploaded.push(path);
  }
  return response(200,{referenceId,count:uploaded.length},origin);
 }catch(error){console.error('Reference upload failed:',error);return response(500,{error:'Image upload failed. Please retry.'},origin);}
});
