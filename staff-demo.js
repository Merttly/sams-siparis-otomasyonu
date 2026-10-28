
/* Sam's Siparis — isolated employee preview. Never load Supabase or persist POS data.
   Each refresh starts a fresh, fully fictional in-memory session. */
(()=>{
'use strict';
const $ = id=>document.getElementById(id);
const money=n=>Number(n||0).toLocaleString('tr-TR',{style:'currency',currency:'TRY'});
const esc=v=>String(v==null?'':v).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const iconTable='<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><circle cx="16" cy="16" r="11.2"/><circle cx="16" cy="16" r="8.7" opacity=".45"/><path d="M9.5 14.8c2.2-2.5 3.9-.5 5.8-2.2m-3.5 8c2.2-1.3 3.7-.6 5.2-2.5" opacity=".35"/></svg>';
const iconCustom='<svg viewBox="0 0 32 32" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="16" cy="11" r="4.5"/><path d="M7 27v-2.5a9 9 0 0 1 18 0V27"/></svg>';
const iconPlus='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
const iconEdit='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M12 20h9"/><path d="M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>';
const iconTrash='<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M3 6h18M8 6V4h8v2M5 6l1 14h12l1-14M10 10v6m4-6v6"/></svg>';
const seedTables=[
 {id:'I1',name:'İç 1',zone:'inside'}, {id:'I2',name:'İç 2',zone:'inside'},
 {id:'I3',name:'İç 3',zone:'inside'}, {id:'I4',name:'İç 4',zone:'inside'},
 {id:'D1',name:'Dış 1',zone:'outside'}, {id:'D2',name:'Dış 2',zone:'outside'},
 {id:'D3',name:'Dış 3',zone:'outside'}, {id:'D4',name:'Dış 4',zone:'outside'},
 {id:'C1',name:'Örnek Grup',zone:'custom'},
 {id:'C2',name:'Özel Masa A',zone:'custom'}
];
const products=[
 {id:1,n:'Filtre Kahve',c:'Kahve',p:140,e:120},
 {id:2,n:'Caffe Latte',c:'Kahve',p:175,e:155},
 {id:3,n:'Türk Kahvesi',c:'Kahve',p:100,e:90},
 {id:4,n:'Iced White Mocha',c:'Soğuk Kahve',p:195,e:175},
 {id:5,n:'Cold Brew',c:'Soğuk Kahve',p:185,e:165},
 {id:6,n:'Sünepe Tost',c:'Tost',p:160,e:145},
 {id:7,n:'Kasap Tost',c:'Tost',p:210,e:190},
 {id:8,n:'Fit Bowl',c:'Bowls',p:240,e:220,variants:['Tavuklu','Ton Balıklı','Vejetaryen']},
 {id:9,n:'General Bowl',c:'Bowls',p:270,e:245,variants:['Tavuklu','Etli']},
 {id:10,n:'Ayran',c:'İçecek',p:40,e:35},
 {id:11,n:'Çay',c:'İçecek',p:40,e:35},
 {id:12,n:'Cookie',c:'Tatlı',p:140,e:130}
];
const initialOrders={
 I2:[{n:'Filtre Kahve',p:140,q:2,tariff:'normal'},{n:'Cookie',p:140,q:1,tariff:'normal'}],
 I4:[{n:'Iced White Mocha',p:195,q:2,tariff:'normal'}],
 D1:[{n:'Kasap Tost',p:210,q:2,tariff:'normal'},{n:'Ayran',p:40,q:2,tariff:'normal'}],
 D3:[{n:'Fit Bowl · Tavuklu',p:240,q:1,tariff:'normal'},{n:'Caffe Latte',p:175,q:2,tariff:'normal'}],
 C1:[{n:'Çay',p:40,q:3,tariff:'normal'}]
};
let tables=[],orders={},notes={},selected=null,category='Kahve',tariff='normal',last=null,mode='search',dirty=false,version=1;
const copy=obj=>JSON.parse(JSON.stringify(obj));
const total=lines=>(lines||[]).reduce((a,x)=>a+Number(x.p)*Number(x.q),0);
const current=()=>orders[selected]||[];
const visible=(id,on)=>{const el=$(id);if(el)el.classList.toggle('hidden',!on)};
function flash(message,error){
 const el=$('demo-toast');
 el.textContent=message;el.hidden=false;el.dataset.error=error?'true':'false';
 clearTimeout(flash.t);flash.t=setTimeout(()=>el.hidden=true,4400);
}
function reset(){
 tables=copy(seedTables);orders=copy(initialOrders);notes={};selected=null;last=null;mode='search';dirty=false;version=1;
 $('staff-table-search').value=''; $('note').value='';
 renderTables();renderEditor();renderStaffTools();flash('Örnek veriler başlangıç durumuna döndü.');
}
function openTable(id){
 if(!tables.some(x=>x.id===id))return;
 selected=id;last=id;dirty=false;renderTables();renderEditor();renderStaffTools();
 $('editor').scrollIntoView({behavior:'smooth',block:'start'});
}
function goHome(ordersTab){
 selected=null;dirty=false;renderEditor();renderTables();renderStaffTools();
 const where=ordersTab?$('pos-table-heading'):$('pos-hero');
 where.scrollIntoView({behavior:'smooth',block:'start'});
}
function nav(){
 document.querySelectorAll('[data-desktop-nav]').forEach(el=>{
  const active=el.dataset.desktopNav===(selected?'orders':'home');
  el.classList.toggle('desktop-active',active);
 });
 $('pos-nav-tables').classList.toggle('active',!selected);
 $('pos-nav-orders').classList.toggle('active',!!selected);
}
function renderTables(){
 const active=tables.filter(t=>total(orders[t.id])>0);
 $('pos-open-count').textContent=String(active.length);
 $('pos-open-total').textContent=money(active.reduce((sum,t)=>sum+total(orders[t.id]),0));
 const sections=[
  {key:'outside',title:'Dış',rows:tables.filter(t=>t.zone==='outside')},
  {key:'inside',title:'İç',rows:tables.filter(t=>t.zone==='inside')},
  {key:'custom',title:'Özel Masalar',rows:tables.filter(t=>t.zone==='custom')}
 ];
 function card(t){
  const sum=total(orders[t.id]),number=t.name.match(/\d+$/),mark=t.zone==='custom'?'':number?String(number[0]).padStart(2,'0'):'';
  const button='<button type="button" data-table="'+esc(t.id)+'" class="'+(sum?'table-open ':'')+(t.zone==='custom'?'table-custom':'')+'" aria-label="'+esc(t.name+(sum?' '+money(sum):' boş'))+'">'+
   (mark?'<span class="table-watermark" aria-hidden="true">'+mark+'</span>':'')+
   '<span class="table-symbol">'+(t.zone==='custom'?iconCustom:iconTable)+'</span>'+
   '<span class="table-label">'+esc(t.name)+'</span><small>'+(sum?money(sum):'Boş')+'</small></button>';
  if(t.zone!=='custom')return button;
  return '<div class="custom-table-card">'+button+'<div class="custom-table-actions">'+
   '<button type="button" data-rename="'+esc(t.id)+'">'+iconEdit+'<span>Düzenle</span></button>'+
   '<button type="button" data-remove="'+esc(t.id)+'">'+iconTrash+'<span>Kaldır</span></button></div></div>';
 }
 $('tables').innerHTML=sections.map(s=>'<section class="table-section table-section--'+s.key+'">'+
  '<div class="table-section-header"><h3>'+s.title+'</h3><span class="table-section-count">'+
  s.rows.filter(t=>total(orders[t.id])>0).length+'/'+s.rows.length+' Dolu</span></div>'+
  '<div class="table-section-grid">'+s.rows.map(card).join('')+'</div></section>').join('');
 $('tables').querySelectorAll('[data-table]').forEach(el=>el.onclick=()=>openTable(el.dataset.table));
 $('tables').querySelectorAll('[data-rename]').forEach(el=>el.onclick=()=>renameTable(el.dataset.rename));
 $('tables').querySelectorAll('[data-remove]').forEach(el=>el.onclick=()=>removeTable(el.dataset.remove));
 nav();
}
function renameTable(id){
 const t=tables.find(x=>x.id===id);if(!t)return;
 const name=prompt('DEMO · Özel masa adı',t.name);
 if(name&&name.trim()){t.name=name.trim().slice(0,50);renderTables();if(selected===id)renderEditor();flash('Özel masa adı örnek verilerde güncellendi.');}
}
function removeTable(id){
 if(total(orders[id])>0){flash('Dolu özel masa kaldırılamaz (örnek kural).',true);return;}
 if(confirm('Örnek özel masa kaldırılsın mı?')){tables=tables.filter(t=>t.id!==id);renderTables();flash('Özel masa yalnızca demo içinde kaldırıldı.');}
}
function activeTable(){return tables.find(x=>x.id===selected)}
function renderEditor(){
 visible('editor',!!selected);nav();if(!selected)return;
 $('table-title').textContent=activeTable()?.name||'Masa';
 $('revision').textContent='DEMO · Sürüm '+version;
 $('dirty-notice').textContent='Örnek değişiklikler yalnızca bu önizlemede tutulur.';
 visible('dirty-notice',dirty);
 $('tariff-normal').className=tariff==='normal'?'':'alt';
 $('tariff-esnaf').className=tariff==='esnaf'?'':'alt';
 const cats=[...new Set(products.map(x=>x.c))];if(!cats.includes(category))category=cats[0];
 $('categories').innerHTML=cats.map(x=>'<button type="button" class="'+(x===category?'':'alt')+'" data-cat="'+esc(x)+'">'+esc(x)+'</button>').join('');
 $('categories').querySelectorAll('[data-cat]').forEach(el=>el.onclick=()=>{category=el.dataset.cat;renderEditor()});
 const shown=products.filter(p=>p.c===category);
 $('products').innerHTML=shown.map(p=>'<button type="button" class="alt product" data-product="'+p.id+'"><span class="product-name">'+esc(p.n)+'</span><span class="product-price">'+(p.variants?'Seçenekleri gör':money(tariff==='esnaf'?p.e:p.p))+'</span></button>').join('');
 $('products').querySelectorAll('[data-product]').forEach(el=>el.onclick=()=>pickProduct(Number(el.dataset.product)));
 const favs=[1,4,8,10].map(id=>products.find(p=>p.id===id));
 $('popular-shortcuts').innerHTML=favs.map(p=>'<button type="button" class="editor-popular-item" data-fav="'+p.id+'">'+
  '<span class="editor-popular-icon">☆</span><span class="editor-popular-copy"><strong>'+esc(p.n)+'</strong><small>'+money(tariff==='esnaf'?p.e:p.p)+'</small></span>'+
  '<span class="editor-popular-plus">'+iconPlus+'</span></button>').join('');
 $('popular-shortcuts').querySelectorAll('[data-fav]').forEach(el=>el.onclick=()=>pickProduct(Number(el.dataset.fav)));
 const lines=current();
 $('lines').innerHTML=lines.length?'<div class="order-lines">'+lines.map((line,i)=>'<div class="order-line">'+
  '<div class="order-line-details"><div class="order-line-name">'+esc(line.n)+(line.tariff==='esnaf'?' · Esnaf':'')+'</div>'+
  '<div class="order-line-meta">Birim '+money(line.p)+'</div></div><div class="order-line-actions"><strong class="order-line-sum">'+money(line.p*line.q)+'</strong>'+
  '<div class="order-line-stepper" role="group"><button class="order-line-step" type="button" data-minus="'+i+'">−</button>'+
  '<span class="order-line-qty">'+line.q+'</span><button class="order-line-step" type="button" data-plus="'+i+'">+</button></div></div></div>').join('')+'</div>':'<p class="muted">Masa boş.</p>';
 $('lines').querySelectorAll('[data-minus]').forEach(el=>el.onclick=()=>changeQty(Number(el.dataset.minus),-1));
 $('lines').querySelectorAll('[data-plus]').forEach(el=>el.onclick=()=>changeQty(Number(el.dataset.plus),1));
 $('note').value=notes[selected]||'';
 $('total').textContent=money(total(lines));
 ['pay-cash','pay-card','split','transfer'].forEach(id=>$(id).disabled=!lines.length);
}
function pickProduct(id){
 const p=products.find(x=>x.id===id);if(!p||!selected)return;
 if(p.variants){
  const body='<p>Yalnızca örnek seçenekler.</p><div class="demo-options">'+p.variants.map(v=>'<button type="button" data-variant="'+esc(v)+'">'+esc(v)+'</button>').join('')+'</div>';
  dialog('Ürün Seçeneği · '+p.n,body);
  $('demo-dialog').querySelectorAll('[data-variant]').forEach(el=>el.onclick=()=>{closeDialog();addLine(p.n+' · '+el.dataset.variant,tariff==='esnaf'?p.e:p.p);});
 }else addLine(p.n,tariff==='esnaf'?p.e:p.p);
}
function addLine(name,price){
 const list=orders[selected]||(orders[selected]=[]);
 const found=list.find(x=>x.n===name&&x.p===price);
 if(found)found.q++;else list.push({n:name,p:price,q:1,tariff});
 dirty=true;renderTables();renderEditor();flash(name+' örnek siparişe eklendi.');
}
function changeQty(index,delta){
 const list=current(),line=list[index];if(!line)return;
 line.q+=delta;if(line.q<=0)list.splice(index,1);
 dirty=true;renderTables();renderEditor();
}
function save(){
 if(!selected)return;
 dirty=false;version++;renderTables();renderEditor();flash('Örnek sipariş kaydedildi. Gerçek kayıt oluşturulmadı.');
}
function dialog(title,content){
 closeDialog();
 const root=document.createElement('div');root.id='demo-dialog';root.className='demo-modal';root.innerHTML='<div class="demo-sheet" role="dialog" aria-modal="true" aria-label="'+esc(title)+'">'+
 '<div class="demo-modal-head"><h3>'+esc(title)+'</h3><button type="button" id="demo-modal-close" aria-label="Kapat">×</button></div>'+
 '<div class="demo-dialog-body">'+content+'</div></div>';
 root.addEventListener('click',e=>{if(e.target===root)closeDialog()});
 document.body.appendChild(root);$('demo-modal-close').onclick=closeDialog;
}
function closeDialog(){const el=$('demo-dialog');if(el)el.remove();}
function finalizePayment(method){
 if(!selected||!current().length)return;
 dialog(method+' ile Masa Kapat','<p><b>'+esc(activeTable().name)+'</b> · Örnek toplam <b>'+money(total(current()))+'</b></p>'+
 '<p>Bu işlem yalnızca sahte verileri değiştirir. Hiçbir ödeme yapılmaz.</p>'+
 '<div class="demo-options"><button id="demo-confirm-pay" type="button">Örnek Hesabı Kapat</button><button id="demo-cancel-pay" type="button" class="alt">Vazgeç</button></div>');
 $('demo-confirm-pay').onclick=()=>{const id=selected;delete orders[id];delete notes[id];closeDialog();selected=null;dirty=false;renderTables();renderEditor();renderStaffTools();flash(method+' ile örnek masa kapatıldı. Gerçek ödeme yapılmadı.');};
 $('demo-cancel-pay').onclick=closeDialog;
}
function splitPayment(){
 if(!selected||!current().length)return;
 const rows=current().map((x,i)=>'<label class="demo-split-row"><span>'+esc(x.n)+' <small>('+x.q+' adet)</small></span>'+
 '<input type="number" min="0" max="'+x.q+'" step="1" value="0" data-split="'+i+'"></label>').join('');
 dialog('Parça Hesap Al','<p>Örnek tahsil edilecek adetleri seçin.</p>'+rows+
 '<label>Ödeme türü<select id="demo-split-method"><option>Nakit</option><option>Kart</option></select></label>'+
 '<p id="demo-split-total"><b>Seçilen toplam: '+money(0)+'</b></p>'+
 '<div class="demo-options"><button id="demo-split-confirm">Örnek Parçayı Tahsil Et</button><button class="alt" id="demo-split-cancel">Vazgeç</button></div>');
 function selection(){let sum=0;const picks=[];
 $('demo-dialog').querySelectorAll('[data-split]').forEach(input=>{
  const i=Number(input.dataset.split),q=Math.max(0,Math.min(current()[i].q,Math.floor(Number(input.value)||0)));
  picks.push({i,q});sum+=current()[i].p*q;
 });$('demo-split-total').innerHTML='<b>Seçilen toplam: '+money(sum)+'</b>';return {sum,picks};}
 $('demo-dialog').querySelectorAll('[data-split]').forEach(el=>el.oninput=selection);
 $('demo-split-confirm').onclick=()=>{
  const data=selection();if(data.sum<=0){flash('Önce tahsil edilecek ürün adedini seçin.',true);return;}
  const method=$('demo-split-method').value;
  for(let i=data.picks.length-1;i>=0;i--){const pick=data.picks[i];current()[pick.i].q-=pick.q;if(current()[pick.i].q===0)current().splice(pick.i,1);}
  if(!current().length){delete orders[selected];selected=null;}
  dirty=false;version++;closeDialog();renderTables();renderEditor();renderStaffTools();
  flash('Örnek parça hesap '+money(data.sum)+' · '+method+' tamamlandı. Gerçek tahsilat yok.');
 };
 $('demo-split-cancel').onclick=closeDialog;
}
function transfer(){
 if(!selected||!current().length)return;
 const from=selected,available=tables.filter(t=>t.id!==from);
 dialog('Hedef Masayı Seç','<p>'+esc(activeTable().name)+' siparişleri taşınacak. Hedef doluysa hesaplar birleşir.</p>'+
 '<div class="demo-options">'+available.map(t=>'<button type="button" data-destination="'+esc(t.id)+'">'+esc(t.name)+' <small>'+ (total(orders[t.id])?'Dolu · Birleştir':'Boş · Taşı')+'</small></button>').join('')+'</div>');
 $('demo-dialog').querySelectorAll('[data-destination]').forEach(el=>el.onclick=()=>{
  const to=el.dataset.destination,wasOccupied=total(orders[to])>0;
  orders[to]=(orders[to]||[]).concat(orders[from]||[]);delete orders[from];
  notes[to]=[notes[to],notes[from]].filter(Boolean).join(' · ');delete notes[from];
  selected=to;last=to;dirty=false;version++;closeDialog();renderTables();renderEditor();renderStaffTools();
  flash('Örnek masa '+(wasOccupied?'birleştirildi':'taşındı')+'. Gerçek veriler değişmedi.');
 });
}
function renderStaffTools(){
 const field=$('staff-table-search');if(!field)return;
 const query=field.value.toLocaleLowerCase('tr-TR').trim();
 const choosing=mode!=='search',show=choosing||query.length>0;
 visible('staff-tool-picker',show);
 const labels={split:'Parça hesap için masa seç',transfer:'Taşınacak masayı seç',close:'Kapatılacak masayı seç'};
 $('staff-tool-heading').textContent=labels[mode]||'Masa sonuçları';
 if(show){
  const matches=tables.filter(t=>(!choosing||total(orders[t.id])>0)&&(!query||t.name.toLocaleLowerCase('tr-TR').includes(query)));
  $('staff-tool-results').innerHTML=matches.length?matches.map(t=>'<button type="button" class="staff-pick-row" data-staff-target="'+esc(t.id)+'">'+
   '<span>'+esc(t.name)+'</span><small>'+(total(orders[t.id])?'Açık':'Boş')+'</small></button>').join(''):'<p class="staff-empty">Uygun masa bulunamadı.</p>';
  $('staff-tool-results').querySelectorAll('[data-staff-target]').forEach(el=>el.onclick=()=>{
   const action=mode;mode='search';field.value='';openTable(el.dataset.staffTarget);renderStaffTools();
   if(action==='split')splitPayment();if(action==='transfer')transfer();if(action==='close')closeMethodDialog();
  });
 }
 $('desktop-staff-last').disabled=!last;
 $('staff-last-label').textContent=tables.find(t=>t.id===last)?.name||'Henüz masa açılmadı';
 ['desktop-staff-split','desktop-staff-transfer','desktop-staff-close'].forEach(id=>$(id).disabled=!tables.some(t=>total(orders[t.id])>0));
}
function closeMethodDialog(){
 if(!selected||!current().length)return;
 dialog('Masa Kapat','<p>'+esc(activeTable().name)+' · '+money(total(current()))+'</p>'+
 '<div class="demo-options"><button type="button" id="demo-cash">Nakit ile Kapat</button><button type="button" id="demo-card">Kart ile Kapat</button></div>');
 $('demo-cash').onclick=()=>finalizePayment('Nakit');$('demo-card').onclick=()=>finalizePayment('Kart');
}
function addCustom(){
 const name=prompt('Örnek özel masa adı','Özel Masa '+(tables.filter(x=>x.zone==='custom').length+1));
 if(name&&name.trim()){const id='C'+String(Date.now());tables.push({id,name:name.trim().slice(0,50),zone:'custom'});renderTables();flash('Özel masa yalnızca önizlemeye eklendi.');}
}
function init(){
 $('auth').classList.add('hidden');
 $('manager-screen').classList.add('hidden');
 $('workspace').classList.remove('hidden','desktop-manager');
 $('workspace').classList.add('desktop-staff');
 $('pos-bottom-nav').classList.remove('hidden','nav-manager');
 ['pos-day-end','pos-history','pos-admin','pos-nav-report','pos-nav-history','pos-nav-admin','report','audit','staff-admin','manager-dashboard','desktop-quick','editor-popular-sort-toggle','custom'].forEach(id=>visible(id,false));
 $('account-btn').classList.remove('hidden');
 $('header-user-name').textContent='Örnek Kullanıcı';
 $('desktop-username').textContent='Örnek Kullanıcı';
 $('logout').classList.remove('hidden');
 $('logout').textContent='Gerçek Panele Dön';
 $('logout').onclick=()=>location.assign('./shared-test.html');
 $('msg').textContent='Kullanıcı Önizlemesi · Yalnızca örnek veriler';
 $('msg').className='status good';
 const badge=$('pos-hero').querySelector('.pos-live');if(badge)badge.innerHTML='<i></i> DEMO';
 $('pos-hero').querySelector('.pos-kicker').textContent='SAM’S COFFEE · ÖRNEK';
 $('theme-toggle').addEventListener('click',()=>{
  const dark=document.documentElement.dataset.theme!=='dark';
  if(dark)document.documentElement.dataset.theme='dark';else delete document.documentElement.dataset.theme;
  $('theme-toggle').setAttribute('aria-pressed',String(dark));
 });
 $('account-btn').onclick=()=>dialog('Örnek Kullanıcı','<p>Rol: Çalışan</p><p>Bu önizleme gerçek kullanıcı hesabı gerektirmez. Tüm hesaplar ve hareketler hayalîdir.</p>');
 $('pos-new-order').onclick=()=>goHome(true);
 $('refresh').onclick=()=>{renderTables();flash('Örnek masalar güncellendi.');};
 $('custom').onclick=addCustom;
 $('back-table').onclick=()=>goHome(false);
 $('pos-nav-tables').onclick=()=>goHome(false);
 $('pos-nav-orders').onclick=()=>goHome(true);
 document.querySelectorAll('[data-desktop-nav]').forEach(el=>el.onclick=()=>{
  if(el.dataset.desktopNav==='home')goHome(false);
  if(el.dataset.desktopNav==='orders')goHome(true);
 });
 $('tariff-normal').onclick=()=>{tariff='normal';renderEditor();};
 $('tariff-esnaf').onclick=()=>{tariff='esnaf';renderEditor();};
 $('save').onclick=save;
 $('note').oninput=()=>{if(!selected)return;notes[selected]=$('note').value;dirty=true;visible('dirty-notice',true);};
 $('pay-cash').onclick=()=>finalizePayment('Nakit');
 $('pay-card').onclick=()=>finalizePayment('Kart');
 $('split').onclick=splitPayment;
 $('transfer').onclick=transfer;
 $('desktop-staff-close').onclick=()=>{mode='close';$('staff-table-search').value='';renderStaffTools();};
 $('desktop-staff-split').onclick=()=>{mode='split';$('staff-table-search').value='';renderStaffTools();};
 $('desktop-staff-transfer').onclick=()=>{mode='transfer';$('staff-table-search').value='';renderStaffTools();};
 $('desktop-staff-last').onclick=()=>last&&openTable(last);
 $('staff-tool-cancel').onclick=()=>{mode='search';$('staff-table-search').value='';renderStaffTools();};
 $('staff-table-search').oninput=()=>{mode='search';renderStaffTools();};
 $('staff-table-search').onkeydown=e=>{
  if(e.key==='Enter'){const el=$('staff-tool-results').querySelector('[data-staff-target]');if(el)el.click();}
 };
 $('demo-reset').onclick=()=>{if(confirm('Örnek masalar ve siparişler başa dönsün mü?'))reset();};
 document.addEventListener('keydown',e=>{if(e.key==='Escape')closeDialog();});
 reset();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',init,{once:true});else init();
})();
