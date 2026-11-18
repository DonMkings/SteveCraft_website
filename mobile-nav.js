// Mobile-only navigation behavior. Native <details> remains operable without JS.
const menu=document.getElementById('mobile-menu');
if(menu){
  menu.querySelectorAll('nav a').forEach(link=>{
    link.addEventListener('click',()=>{menu.open=false;});
  });
  document.addEventListener('pointerdown',event=>{
    if(menu.open&&!menu.contains(event.target))menu.open=false;
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape'&&menu.open){
      menu.open=false;
      menu.querySelector('summary')?.focus();
    }
  });
  const desktop=window.matchMedia('(min-width: 701px)');
  const closeOnDesktop=()=>{if(desktop.matches)menu.open=false;};
  desktop.addEventListener('change',closeOnDesktop);
}
