import {SUPABASE_URL,SUPABASE_PUBLISHABLE_KEY} from './supabase-config.js';
const $=id=>document.getElementById(id);
const money=new Intl.NumberFormat('en-NG',{style:'currency',currency:'NGN',maximumFractionDigits:0});
const CART_KEY='steve-craft-cart-v1';
const PHONE='2349039910197';
let products=[],cart=[],active=null,activeSize='',filter='all';
try{const saved=JSON.parse(localStorage.getItem(CART_KEY)||'[]');if(Array.isArray(saved))cart=saved.filter(x=>x&&typeof x.id==='string'&&typeof x.size==='string'&&Number.isSafeInteger(x.qty)&&x.qty>0).slice(0,40);}catch{}
const format=x=>money.format(Number(x)||0);
const el=(tag,cls,text)=>{const node=document.createElement(tag);if(cls)node.className=cls;if(text!==undefined)node.textContent=String(text);return node;};
const safeText=x=>String(x??'').trim().slice(0,500);
function getVariant(p,size){return (p?.variants||[]).find(v=>v.size===size);}
function inStock(p){return (p.variants||[]).some(v=>v.stock_quantity>0);}
function saveCart(){try{localStorage.setItem(CART_KEY,JSON.stringify(cart));}catch{}updateCount();}
function updateCount(){const n=cart.reduce((s,x)=>s+x.qty,0);$('cart-count').textContent=n;$('open-cart').setAttribute('aria-label','Open cart, '+n+' items');}
function imageFor(p){const img=el('img');img.loading='lazy';img.alt=p.name;img.src=p.image_url||'';img.addEventListener('error',()=>{img.replaceWith(el('span','shop-image-fallback','STEVE CRAFT'));},{once:true});return img;}
function setNotice(text){$('shop-status').textContent=text;}
async function loadProducts(){
 if(!SUPABASE_URL||!SUPABASE_PUBLISHABLE_KEY){setNotice('The new collection will appear here once the SteveCraft Supabase catalog is connected.');renderProducts();return;}
 try{
  const base=SUPABASE_URL.replace(/\/$/,'');
  if(!/^https:\/\/[a-z0-9.-]+\.supabase\.co$/i.test(base))throw Error('Invalid Supabase project URL');
  const response=await fetch(base+'/rest/v1/products?select=id,name,slug,description,category,price_naira,image_url,is_made_to_order,variants:product_variants(id,size,stock_quantity)&is_published=eq.true&order=created_at.desc',{
   headers:{apikey:SUPABASE_PUBLISHABLE_KEY,'Accept':'application/json'}
  });
  if(!response.ok)throw Error('Catalog could not be loaded ('+response.status+').');
  const result=await response.json();
  if(!Array.isArray(result))throw Error('Catalog format was unexpected.');
  products=result.filter(p=>p&&p.id&&p.name&&Number(p.price_naira)>=0).map(p=>({...p,price_naira:Number(p.price_naira),variants:(p.variants||[]).filter(v=>v.size&&Number.isInteger(v.stock_quantity)&&v.stock_quantity>=0)}));
  setNotice(products.length?'':'No published footwear yet. Please check back for new arrivals.');
  renderProducts();
 }catch(error){setNotice('The collection is temporarily unavailable. You can still request a custom pair through the Design Studio.');console.error('SteveCraft catalog:',error);renderProducts();}
}
function filtered(){const term=$('shop-search').value.trim().toLowerCase();return products.filter(p=>(filter==='all'||(filter==='ready'&&inStock(p))||(filter==='custom'&&p.is_made_to_order))&&(!term||(p.name+' '+(p.description||'')+' '+(p.category||'')).toLowerCase().includes(term)));}
function renderProducts(){
 const root=$('shop-products');root.replaceChildren();
 const list=filtered();
 if(!list.length){if(products.length)root.append(el('p','shop-empty','No designs match this search. Try another option.'));return;}
 for(const p of list){
  const card=el('article','shop-card');
  const open=el('button','shop-photo');open.type='button';open.setAttribute('aria-label','View '+p.name);open.append(imageFor(p));open.addEventListener('click',()=>showProduct(p.id));card.append(open);
  const body=el('div','shop-card-body');
  body.append(el('p','shop-kicker',inStock(p)?'READY-MADE AVAILABLE':p.is_made_to_order?'MADE TO ORDER':'CURRENTLY UNAVAILABLE'));
  body.append(el('h3','shop-card-name',p.name));
  if(p.category)body.append(el('p','shop-category',p.category));
  body.append(el('p','shop-price',format(p.price_naira)));
  body.append(el('p','shop-price-note','Listed price is subject to confirmation before payment.'));
  const action=el('button','button primary shop-view','View options ↗');action.type='button';action.addEventListener('click',()=>showProduct(p.id));body.append(action);card.append(body);root.append(card);
 }
}
function showProduct(id){
 const p=products.find(x=>x.id===id);if(!p)return;
 active=p;activeSize='';const root=$('shop-product-body');root.replaceChildren();
 const media=el('div','shop-detail-media');media.append(imageFor(p));root.append(media);
 const detail=el('div','shop-detail-copy');
 detail.append(el('p','shop-kicker',inStock(p)?'READY-MADE AVAILABLE':'REQUEST A SIMILAR PAIR'));
 detail.append(el('h2','shop-detail-title',p.name));detail.append(el('p','shop-price',format(p.price_naira)));
 detail.append(el('p','shop-description',p.description||'Handcrafted footwear by SteveCraft.'));
 if(inStock(p)){
  const label=el('label','input-label','SELECT AVAILABLE SIZE');label.htmlFor='shop-size';
  const sel=el('select');sel.id='shop-size';const placeholder=el('option','','Choose your size');placeholder.value='';sel.append(placeholder);
  for(const v of p.variants.filter(v=>v.stock_quantity>0).sort((a,b)=>Number(a.size)-Number(b.size))){const opt=el('option','',`EU ${v.size} · ${v.stock_quantity} available`);opt.value=v.size;sel.append(opt);}
  sel.addEventListener('change',()=>{activeSize=sel.value;});
  label.append(sel);detail.append(label);
  const add=el('button','button primary full shop-add','Add to cart ↗');add.type='button';add.addEventListener('click',()=>addCart(p,activeSize));detail.append(add);
 }
 const make=el('button','button outline full shop-add','Request this design ↗');make.type='button';make.addEventListener('click',()=>showRequest(p));detail.append(make);
 detail.append(el('p','shop-price-note','Made-to-order prices, availability and production time are confirmed directly with SteveCraft. No payment is collected on this site.'));
 root.append(detail);$('shop-product-dialog').showModal();
}
function addCart(p,size){
 if(!size){$('shop-product-body').querySelector('#shop-size')?.focus();return;}
 const variant=getVariant(p,size);if(!variant||variant.stock_quantity<1)return;
 const item=cart.find(x=>x.id===p.id&&x.size===size);
 if(item){if(item.qty>=variant.stock_quantity){alert('Only '+variant.stock_quantity+' pair(s) currently shown as available in this size.');return;}item.qty++;}
 else cart.push({id:p.id,size,qty:1});
 saveCart();$('shop-product-dialog').close();openCart();
}
function renderCart(){
 const root=$('cart-items');root.replaceChildren();let total=0,valid=0;
 if(!cart.length){root.append(el('p','shop-empty','Your cart is empty. Browse the collection to get started.'));}
 for(const item of cart){
  const p=products.find(x=>x.id===item.id);
  if(!p){const missing=el('div','cart-row');missing.append(el('p','','An item is no longer listed. Please remove it.'));const remove=el('button','text-link','Remove');remove.type='button';remove.addEventListener('click',()=>removeCart(item));missing.append(remove);root.append(missing);continue;}
  const stock=getVariant(p,item.size)?.stock_quantity||0;
  if(stock>=item.qty&&stock>0){total+=p.price_naira*item.qty;valid++;}
  const row=el('div','cart-row');
  const info=el('div');info.append(el('strong','',p.name),el('p','',`EU ${item.size} · ${format(p.price_naira)} each`));
  if(stock<item.qty)info.append(el('p','shop-stock-warning',`Stock now shows ${stock} available. Reduce or remove this item.`));
  const controls=el('div','cart-controls');
  for(const [label,delta] of [['−',-1],['+',1]]){const btn=el('button','cart-quantity',label);btn.type='button';btn.setAttribute('aria-label',(delta===1?'Increase':'Decrease')+' quantity for '+p.name);btn.disabled=delta===1&&item.qty>=stock;btn.addEventListener('click',()=>{item.qty+=delta;if(item.qty<=0)cart=cart.filter(x=>x!==item);saveCart();renderCart();});controls.append(btn);}
  controls.append(el('span','',item.qty));
  const rm=el('button','text-link','Remove');rm.type='button';rm.addEventListener('click',()=>removeCart(item));
  controls.append(rm);row.append(info,controls);root.append(row);
 }
 $('cart-total').textContent=format(total);
 $('cart-order').disabled=!cart.length||valid!==cart.length;
 $('cart-order').textContent=valid!==cart.length&&cart.length?'Check unavailable items first':'Prepare WhatsApp order ↗';
}
function removeCart(item){cart=cart.filter(x=>x!==item);saveCart();renderCart();}
function openCart(){$('shop-cart-dialog').showModal();renderCart();}
function buildOrder(){
 const lines=['Hello SteveCraft, I would like to enquire about purchasing the following ready-made footwear:',''];
 let total=0;
 for(const item of cart){const p=products.find(x=>x.id===item.id);if(!p||!getVariant(p,item.size)||getVariant(p,item.size).stock_quantity<item.qty)return null;total+=p.price_naira*item.qty;lines.push(`- ${p.name} | EU ${item.size} | Qty: ${item.qty} | ${format(p.price_naira*item.qty)}`);}
 lines.push('',`Indicative item total: ${format(total)}`,'','Please confirm stock, final price, delivery charges, payment instructions and order details before I pay.','This is an enquiry, not a completed purchase.');
 return lines.join('\n');
}
function showRequest(p){
 $('shop-product-dialog').close();$('request-product').textContent=p.name;
 $('request-size').value='';$('request-notes').value='';$('request-status').textContent='';
 $('shop-request-dialog').dataset.productId=p.id;
 $('shop-request-dialog').showModal();
}
function setup(){
 $('open-cart').addEventListener('click',openCart);
 $('shop-search').addEventListener('input',renderProducts);
 document.querySelectorAll('[data-shop-filter]').forEach(btn=>btn.addEventListener('click',()=>{filter=btn.dataset.shopFilter;document.querySelectorAll('[data-shop-filter]').forEach(x=>x.setAttribute('aria-pressed',String(x===btn)));renderProducts();}));
 $('cart-order').addEventListener('click',()=>{const msg=buildOrder();if(!msg){renderCart();return;}const url='https://wa.me/'+PHONE+'?text='+encodeURIComponent(msg);const link=$('cart-whatsapp-link');link.href=url;$('cart-checkout').hidden=false;link.focus();});
 $('cart-edit').addEventListener('click',()=>{$('cart-checkout').hidden=true;renderCart();});
 $('shop-request-form').addEventListener('submit',event=>{event.preventDefault();const p=products.find(x=>x.id===$('shop-request-dialog').dataset.productId);if(!p)return;const size=safeText($('request-size').value),notes=safeText($('request-notes').value);if(!size){$('request-size').focus();return;}const text=['Hello SteveCraft, I would like a made-to-order quote inspired by a product in your collection.','',`Reference design: ${p.name}`,`Reference ID: ${p.id}`,`Requested EU size: ${size}`,`Preferences / questions: ${notes||'None'}`,'','Please confirm options, fitting, production time and a custom quote before I order.'].join('\n');const link=$('request-whatsapp-link');link.href='https://wa.me/'+PHONE+'?text='+encodeURIComponent(text);$('request-status').textContent='Your request is ready. Open WhatsApp and press Send to deliver it.';link.hidden=false;link.focus();});
 $('request-size').addEventListener('change',()=>{$('request-whatsapp-link').hidden=true;});
 $('request-notes').addEventListener('input',()=>{$('request-whatsapp-link').hidden=true;});
 document.querySelectorAll('[data-shop-close]').forEach(btn=>btn.addEventListener('click',()=>btn.closest('dialog').close()));
 updateCount();loadProducts();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',setup);else setup();
