import {STYLES,COLOURS,FINISHES,SOLES,WIDTHS,SIZES,DEFAULT_DESIGN,normaliseDesign,validateRequest,buildMessage,contactLinks} from './model.js';
import {shoeSVG} from './shoe.js';
const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s);
let design={...DEFAULT_DESIGN},view='profile',message='';
try{const saved=localStorage.getItem('steve-craft-design');if(saved)design=normaliseDesign(JSON.parse(saved));}catch{}
for(const [key,value] of Object.entries(COLOURS)){
 const b=document.createElement('button');b.type='button';b.className='swatch';b.dataset.colour=key;b.style.backgroundColor=value.hex;b.setAttribute('aria-label',value.name);b.setAttribute('title',value.name);b.setAttribute('aria-pressed',String(design.colour===key));$('#colour-choices').append(b);
}
for(const id of ['size','quote-size'])for(const size of SIZES){const o=document.createElement('option');o.value=size;o.textContent='EU '+size;$('#'+id).append(o);}
for(const [style,colour]of [['loafer','cognac'],['derby','black'],['slide','sand']])$('#card-'+style).innerHTML=shoeSVG({...DEFAULT_DESIGN,style,colour},'card-'+style);
function render(){
 $('#shoe-preview').innerHTML=shoeSVG(design,'live',view);
 $('#preview-name').textContent=STYLES[design.style]+' / '+COLOURS[design.colour].name;
 $('#mini-summary').textContent=STYLES[design.style]+' · '+COLOURS[design.colour].name;
 $('#colour-value').textContent=COLOURS[design.colour].name;
 for(const key of ['style','colour','finish','sole'])$$('[data-'+key+']').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset[key]===design[key])));
 $$('[data-view]').forEach(b=>b.setAttribute('aria-pressed',String(b.dataset.view===view)));
 $('#size').value=design.size;$('#width').value=design.width;$('#initials').value=design.initials;$('#purpose').value=design.purpose;$('#occasion').value=design.occasion;$('#recipient-name').value=design.recipientName;$('#gift-date').value=design.giftDate;$('#gift-message').value=design.giftMessage;$('#gift-fields').hidden=design.purpose!=='gift';
}
for(const key of ['style','colour','finish','sole'])$$('[data-'+key+']').forEach(b=>b.addEventListener('click',()=>{design[key]=b.dataset[key];render();}));
$$('[data-start-style]').forEach(b=>b.addEventListener('click',()=>{design.style=b.dataset.startStyle;render();$('#studio').scrollIntoView({behavior:matchMedia('(prefers-reduced-motion:reduce)').matches?'instant':'smooth'});}));
$$('[data-view]').forEach(b=>b.addEventListener('click',()=>{view=b.dataset.view;render();}));
for(const key of ['purpose','occasion'])$('#'+key).addEventListener('change',e=>{design[key]=e.target.value;render();});for(const [id,key] of [['recipient-name','recipientName'],['gift-date','giftDate'],['gift-message','giftMessage']])$('#'+id).addEventListener('input',e=>{design[key]=e.target.value;});
for(const key of ['size','width'])$('#'+key).addEventListener('change',e=>{design[key]=e.target.value;render();});
$('#initials').addEventListener('input',e=>{design.initials=normaliseDesign({...design,initials:e.target.value}).initials;render();});
$('#reset').addEventListener('click',()=>{design={...DEFAULT_DESIGN};view='profile';render();$('#saved-status').textContent='Design reset. Your saved design is unchanged until you save again.';});
$('#save-design').addEventListener('click',()=>{try{localStorage.setItem('steve-craft-design',JSON.stringify(design));$('#saved-status').textContent='Design saved in this browser. Come back and pick up where you left off.';}catch{$('#saved-status').textContent='Browser storage is unavailable. Download your design request from the quote window instead.';}});
const quoteDialog=$('#quote-dialog');
function renderSummary(){
 const container=$('#quote-summary');container.replaceChildren();
 const title=document.createElement('strong');title.className='quote-summary-style';title.textContent=STYLES[design.style];container.append(title);
 for(const [name,value]of [['Colour',COLOURS[design.colour].name],['Finish',FINISHES[design.finish]],['Sole',SOLES[design.sole]],['Size',design.size?'EU '+design.size:'Choose below'],['Width',WIDTHS[design.width]],['Initials',design.initials||'None'],['Purpose',design.purpose==='gift'?'As a gift':'For myself'],['Occasion',design.occasion||'Not specified'],...(design.purpose==='gift'?[['Recipient',design.recipientName||'Not specified'],['Gift date',design.giftDate||'Not specified']]:[])]){const div=document.createElement('div'),label=document.createElement('span'),strong=document.createElement('strong');label.textContent=name;strong.textContent=value;div.append(label,strong);container.append(div);}
}
$('#request-quote').addEventListener('click',()=>{renderSummary();$('#quote-size').value=design.size;$('#quote-form').hidden=false;$('#send-options').hidden=true;$('#form-error').textContent='';quoteDialog.showModal();});
$('#quote-size').addEventListener('change',e=>{design.size=e.target.value;render();renderSummary();});
$('#quote-form').addEventListener('submit',e=>{
 e.preventDefault();const values=Object.fromEntries(new FormData(e.currentTarget));design.size=values.size;
 const errors=validateRequest(design,values);if(errors.length){$('#form-error').textContent=errors.join('\n');return;}
 render();renderSummary();message=buildMessage(design,values);const links=contactLinks(message);$('#send-whatsapp').href=links.whatsapp;$('#send-email').href=links.email;$('#quote-form').hidden=true;$('#send-options').hidden=false;$('#copy-status').textContent='';$('#send-whatsapp').focus();
});
$('#edit-request').addEventListener('click',()=>{$('#send-options').hidden=true;$('#quote-form').hidden=false;$('#customer-name').focus();});
function downloadRequest(){const blob=new Blob([message],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='steve-craft-quote-request.txt';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
$('#download-request').addEventListener('click',downloadRequest);
$('#copy-request').addEventListener('click',async()=>{try{await navigator.clipboard.writeText(message);$('#copy-status').textContent='Request copied. Paste it into a message to Steve Craft.';}catch{$('#copy-status').textContent='Clipboard access is unavailable. Use Download request to keep a copy.';}});
$$('[data-close]').forEach(b=>b.addEventListener('click',()=>b.closest('dialog').close()));
$$('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d){const r=d.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)d.close();}}));
function showInfo(title,content){$('#info-title').textContent=title;$('#info-content').innerHTML=content;$('#info-dialog').showModal();}
$('#open-size-guide').addEventListener('click',()=>showInfo('A better fit starts here.','<p>Use your usual EU shoe size as a starting point. Because every style and foot is different, Steve Craft will confirm the fit before making your footwear.</p><ol><li>Stand on a sheet of paper wearing the socks you expect to use.</li><li>Mark the end of your longest toe and the back of your heel. Measure the distance in centimetres.</li><li>Measure across the widest part of your foot, then repeat for the other foot.</li><li>Include both feet’s measurements and any fit concerns in your quote notes.</li></ol><p>If you’re between sizes, outside EU 35–47, or need a particular fit, message Steve Craft on <a class="text-link" href="https://wa.me/2349039910197" target="_blank" rel="noopener noreferrer">WhatsApp ↗</a> before requesting your pair.</p>'));
$('#privacy-button').addEventListener('click',()=>showInfo('Your design. Your details.','<p>The design studio runs in your browser. When you choose Save design, only your footwear preferences are stored on this device. Your name, email, phone number and notes are not stored by this website.</p><p>When you open a quote request in WhatsApp or email, your design and contact details are included in the prepared message. You choose whether to send it. Those services process the message according to their own policies, and Steve Craft receives the details you send.</p><p>To remove a saved design, use the button below. The page loads fonts from Google Fonts; your browser may share basic connection information with that service.</p><button type="button" id="clear-saved-design" class="button outline full">Remove saved design</button><p>For questions about information sent to Steve Craft, email <a class="text-link" href="mailto:ekundayoojo74@gmail.com">ekundayoojo74@gmail.com</a>.</p>'));
$('#info-content').addEventListener('click',e=>{if(e.target.id==='clear-saved-design'){try{localStorage.removeItem('steve-craft-design');e.target.textContent='Saved design removed';}catch{e.target.textContent='Browser storage is unavailable';}}});
$('#year').textContent=new Date().getFullYear();render();