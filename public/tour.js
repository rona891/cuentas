// Tutorial: asistente de configuración inicial (saldos de efectivo, Mercado Pago, dólares y ahorros), recorrido general
// con foco (oscurece todo menos lo que explica), visitas guiadas por sección (botón ? junto a cada título) y la tarjeta
// "Primeros pasos" del Resumen. Estado en settings: tour = nuevo | ofrecer | hecho, pasos = on | off, pv = pasos hechos que no salen de los datos.
const isPC=()=>matchMedia('(min-width:1024px)').matches;
const setQ=(k,v)=>{S.settings[k]=v;return api('settings','PUT',{[k]:v}).then(s=>{S.settings=s}).catch(()=>{})};
const pvHas=k=>(S.settings.pv||'').split(',').includes(k);
function pvAdd(k){if(S.settings.pasos!='on'||pvHas(k))return;setQ('pv',[S.settings.pv,k].filter(Boolean).join(','))}
let TB=false;
function tourBoot(){if(TB||TOUR||$('#wiz'))return;TB=true;if(S.settings.tour=='nuevo')setTimeout(wizard,250)}
async function restartTour(){await setQ('pasos','on');go('res');wizard()}

// ——— Asistente de configuración inicial ———
let WZ=null;
const WST=['hola','ef','mp','usd','aho','fin'];
const efW=()=>AW().find(w=>w.name=='Efectivo'&&w.currency_id==BASE().id),mpW=()=>AW().find(w=>/mercado\s*pago/i.test(w.name)),usdC=()=>S.currencies.find(c=>c.code=='USD'),usdW=()=>{const c=usdC();return c&&AW().find(w=>w.currency_id==c.id)};
function wizard(){const x=today(),ef=efW(),mp=mpW(),uc=usdC(),uw=usdW(),b=w=>w?Math.round(bal(w.id,x)*100)/100||'':'';
WZ={i:0,saved:false,d:{ef:b(ef),mpOn:mp?1:null,mp:b(mp),usdOn:uc?1:null,rate:uc?uc.rate:'',usd:b(uw),ahoOn:null,ahoA:'',ahoU:'',ahoN:t('Mis ahorros'),ahoT:''}};
const ov=document.createElement('div');ov.id='wiz';ov.className='wiz';document.body.appendChild(ov);wzShow(1)}
const SY=c=>CUR(c).symbol+(CUR(c).symbol.length>1?' ':'');
const yn=(n,v)=>`<div class="wyn" data-n="${n}">${[[1,'Sí'],[0,'No']].map(([k,l])=>`<button type="button" data-v="${k}" class="${v===k?'on':''}">${t(l)}</button>`).join('')}</div>`;
function wzBody(k){const d=WZ.d,bs=SY(BASE().id),us='US$ ';
if(k=='hola')return`<div class="wem">👋</div><h2>${t('¡Hola, {0}!',esc(S.username))}</h2><p>${t('Te ayudo a dejar FNz lista en un minuto: te pregunto cuánta plata tenés hoy y dónde, así arrancás con tus saldos reales.')}</p><p class="mut">${t('Todo se puede cambiar después.')}</p>`;
if(k=='ef')return`<div class="wem">💵</div><h2>${t('¿Cuánta plata tenés en efectivo?')}</h2><p class="mut">${t('Lo que tenés en la billetera o guardado en casa para gastar. Si no tenés, dejalo vacío.')}</p>${mi('ef',d.ef,{sym:bs,ph:bs+'0'})}`;
if(k=='mp')return`<div class="wem">📱</div><h2>${t('¿Usás Mercado Pago?')}</h2>${yn('mpOn',d.mpOn)}<div class="wmore" data-if="mpOn"><label>${t('¿Cuánto tenés en Mercado Pago?')}</label>${mi('mp',d.mp,{sym:bs,ph:bs+'0'})}</div>
<p class="mut">${t('Si usás otra billetera virtual o un banco, después la agregás en Menú → Billeteras.')}</p>`;
if(k=='usd')return`<div class="wem">💲</div><h2>${t('¿Tenés dólares?')}</h2>${yn('usdOn',d.usdOn)}<div class="wmore" data-if="usdOn"><label>${t('¿A cuánto está el dólar hoy? (en pesos)')}</label>${mi('rate',d.rate,{sym:bs,ph:bs+'1.000'})}
<label>${t('¿Cuántos dólares tenés para usar?')}</label>${mi('usd',d.usd,{sym:us,ph:us+'0'})}<p class="mut">${t('Si son ahorros, los cargás en el paso siguiente.')}</p></div>`;
if(k=='aho'){if(S.goals.length)return`<div class="wem">🐷</div><h2>${t('Tus ahorros')}</h2><p>${S.goals.length==1?t('Ya tenés 1 caja de ahorro. La ves en la sección Ahorros.'):t('Ya tenés {0} cajas de ahorro. Las ves en la sección Ahorros.',S.goals.length)}</p>`;
return`<div class="wem">🐷</div><h2>${t('¿Tenés plata ahorrada?')}</h2><p class="mut">${t('Plata que separaste y no querés gastar: para un viaje, emergencias o porque sí.')}</p>${yn('ahoOn',d.ahoOn)}
<div class="wmore" data-if="ahoOn"><label>${t('¿Cuánto tenés ahorrado en pesos?')}</label>${mi('ahoA',d.ahoA,{sym:bs,ph:bs+'0'})}${d.usdOn==1?`<label>${t('¿Y en dólares?')}</label>${mi('ahoU',d.ahoU,{sym:us,ph:us+'0'})}`:''}
<label>${t('¿Para qué es? Ponele un nombre')}</label><input name="ahoN" maxlength="60" value="${esc(d.ahoN)}"><label>${t('Meta (opcional)')}</label>${mi('ahoT',d.ahoT,{sym:bs,ph:t('Sin meta')})}
<p class="mut">${t('Se guarda en una caja de ahorro, aparte de la plata para gastar.')}</p></div><div class="wmore" data-if="ahoOn" data-v="0"><p>${t('No pasa nada: cuando quieras separar plata para algo, creás una caja en Ahorros. Te la muestro en el recorrido.')}</p></div>`}
const x=today(),li=AW().map(w=>`<li><span class="cic">${icoH(w.icon)}</span>${esc(w.name)}<b>${money(bal(w.id,x),w.currency_id)}</b></li>`).concat(S.goals.map(g=>`<li><span class="cic">🐷</span>${esc(g.name)}<b>${breakdown(gbal(g))||money(0,g.currency_id)}</b></li>`)).join('');
return`<div class="wem">✅</div><h2>${t('¡Listo!')}</h2><p>${WZ.saved?t('Así quedaron tus cuentas:'):t('Estas son tus cuentas por ahora:')}</p><ul class="wsum">${li}</ul><p>${t('Ahora te muestro cómo se usa la app. Son unos pasos cortos.')}</p>`}
function wzShow(dir){const k=WST[WZ.i],fin=k=='fin',ov=$('#wiz');
ov.innerHTML=`<form class="wcard" novalidate><div class="wtop"><div class="wprog"><i style="width:${WZ.i/(WST.length-1)*100}%"></i></div>${fin?'':`<button type="button" class="l wskip">${t('Saltar')}</button>`}</div>
<div class="wbody ${dir>0?'in-r':'in-l'}">${wzBody(k)}<p class="err"></p></div>
<div class="wnav">${fin?`<button type="button" class="l wsolo">${t('Prefiero explorar solo')}</button>`:WZ.i?`<button type="button" class="l wback">‹ ${t('Atrás')}</button>`:'<span></span>'}<button class="p">${fin?t('Ver el recorrido'):k=='hola'?t('Empezar'):k=='aho'?t('Guardar'):t('Siguiente')} ›</button></div></form>`;
const f=ov.querySelector('form');wzYn(f);f.onclick=e=>{const b=e.target.closest('.wyn button');if(b){WZ.d[b.parentNode.dataset.n]=+b.dataset.v;b.parentNode.querySelectorAll('button').forEach(x=>x.classList.toggle('on',x==b));wzYn(f);const i=f.querySelector('.wmore:not([hidden]) input');if(i&&isPC())i.focus()}
if(e.target.closest('.wback')){wzRead(f);WZ.i--;wzShow(-1)}if(e.target.closest('.wskip'))wzSkip();if(e.target.closest('.wsolo'))wzEnd(false)};
f.onsubmit=e=>{e.preventDefault();wzNext(f)};setTimeout(()=>{const i=f.querySelector('.wbody input:not([hidden])');if(i&&isPC()&&!i.closest('[hidden]'))i.focus()},50)}
function wzYn(f){f.querySelectorAll('.wmore').forEach(m=>{m.hidden=WZ.d[m.dataset.if]!==+(m.dataset.v??1)})}
function wzRead(f){f.querySelectorAll('.wbody input[name]').forEach(i=>{WZ.d[i.name]=i.classList.contains('money')?pmEl(i):i.value})}
async function wzNext(f){wzRead(f);const k=WST[WZ.i],d=WZ.d,e=f.querySelector('.err');e.textContent='';
const need=n=>{if(d[n]==null){e.textContent=t('Elegí Sí o No');return true}};
if(k=='mp'&&need('mpOn')||k=='usd'&&need('usdOn')||k=='aho'&&!S.goals.length&&need('ahoOn'))return;
if(k=='usd'&&d.usdOn==1&&!(+d.rate>0)){e.textContent=t('Poné a cuánto está el dólar');return}
if(k=='aho'&&d.ahoOn==1&&!S.goals.length&&!(+d.ahoA>0)&&!(+d.ahoU>0)){e.textContent=t('Poné cuánto tenés ahorrado (o elegí No)');return}
if(k=='aho'){const b=f.querySelector('.wnav .p');b.disabled=true;b.textContent=t('Guardando…');try{await wzSave()}catch(x){b.disabled=false;b.textContent=t('Guardar')+' ›';e.textContent=x.message;return}}
if(k=='fin')return wzEnd(true);WZ.i++;wzShow(1)}
// Guarda lo que contestó: los saldos se cargan como corrección de saldo ("Saldo inicial"), así no cuentan como ingreso
async function wzSave(){const d=WZ.d,x=today(),re=async()=>Object.assign(S,await api('data')),ini=t('Saldo inicial');
const fix=async(w,v)=>{if(v===''||v==null)return;const df=Math.round((+v-bal(w.id,x))*100)/100;if(df)await api('movements','POST',{type:'ajuste',amount:df,date:x,wallet_id:w.id,detail:ini})};
const mk=async(name,cur,icon,color)=>{await api('wallets','POST',{name,currency_id:cur,icon,color});await re();return AW().find(w=>w.name==name&&w.currency_id==cur)};
let ef=efW();if(!ef&&+d.ef)ef=await mk('Efectivo',BASE().id,'💵','#16A34A');if(ef)await fix(ef,d.ef);
if(d.mpOn==1){let mp=mpW();if(!mp){const v=AW().find(w=>w.name=='Virtual'&&!S.movs.some(m=>m.wallet_id==w.id||m.to_wallet_id==w.id));
if(v){await api('wallets/'+v.id,'PUT',{name:'Mercado Pago',icon:'📱',color:'#009EE3'});await re();mp=WAL(v.id)}else mp=await mk('Mercado Pago',BASE().id,'📱','#009EE3')}await fix(mp,d.mp)}
let uc=usdC();if(d.usdOn==1){if(uc)await api('currencies/'+uc.id,'PUT',{code:'USD',name:uc.name,symbol:uc.symbol,rate:+d.rate});else await api('currencies','POST',{code:'USD',name:t('Dólar'),symbol:'US$',rate:+d.rate});
await re();uc=usdC();let uw=usdW();if(!uw&&+d.usd)uw=await mk(t('Dólares'),uc.id,'💵','#0E9F6E');if(uw)await fix(uw,d.usd)}
if(d.ahoOn==1&&!S.goals.length){const ars=BASE().id,cs=[ars].concat(d.usdOn==1&&uc?[uc.id]:[]),main=+d.ahoA>0||!(+d.ahoU>0)?ars:uc.id;
const{id}=await api('goals','POST',{name:String(d.ahoN||'').trim()||t('Mis ahorros'),target:main==ars?+d.ahoT||0:0,currency_id:main,currencies:cs});
for(const[v,c]of[[d.ahoA,ars],[d.ahoU,uc&&uc.id]])if(+v>0)await api('movements','POST',{type:'ajuste',amount:+v,date:x,goal_id:id,goal_cur:c,detail:ini})}
await setQ('tour','hecho');WZ.saved=true;await re();render(1)}
async function wzSkip(){await setQ('tour','hecho');WZ.i=WST.length-1;wzShow(1)}
function wzEnd(go){const w=$('#wiz');if(w)w.remove();WZ=null;if(go)mainTour();else{setQ('tour','hecho');toast(t('Podés ver el recorrido cuando quieras desde Configuración.'))}}

// ——— Motor del recorrido con foco ———
// Paso: {v: vista que necesita, el: selector | función (elemento o lista), title, text (texto o función), wait: condición que avanza sola,
//  free: deja usar la pantalla, need: selector que tiene que existir (si no, salta al paso con id = alt), center: sin foco}
let TOUR=null;
const tq=x=>typeof x=='function'?x():x;
function tourEls(s){let r=tq(s.el);if(typeof r=='string')r=[...document.querySelectorAll(r)];else if(r&&!Array.isArray(r))r=[r];return(r||[]).filter(e=>{if(!e)return false;const b=e.getBoundingClientRect();return b.width>0&&b.height>0})}
function tour(steps,o={}){tourEnd(1);cselClose();menu(0);const r=document.createElement('div');r.id='tour';r.innerHTML='<div class="tblock"></div><div class="tspot"></div><div class="tbub" role="dialog" aria-live="polite"></div>';
document.body.appendChild(r);document.body.classList.add('touring');TOUR={steps,o,i:-1,r};TOUR.tick=setInterval(tourTick,200);addEventListener('resize',tourPos);addEventListener('scroll',tourPos,true);
r.querySelector('.tbub').onclick=e=>{const b=e.target.closest('button');if(!b)return;if(b.dataset.a=='next')tourGo(TOUR.i+1,1);else if(b.dataset.a=='back')tourGo(TOUR.i-1,-1);else if(b.dataset.a=='skip')tourGo(TOUR.steps.findIndex(s=>s.id==tq(TOUR.steps[TOUR.i].skipTo)),1);else if(b.dataset.a=='end')tourEnd()};
tourGo(0,1)}
function tourGo(i,dir){const T=TOUR;if(!T)return;if(i<0){i=0;dir=1}if(i>=T.steps.length)return tourEnd(0,1);const s=T.steps[i];
if(s.v&&S.view!=s.v)go(s.v);if(s.goal!==undefined&&S.goal!=s.goal){S.goal=s.goal;render()}
if(s.need&&!document.querySelector(s.need))return tourGo(T.steps.findIndex(x=>x.id==s.alt),1);
if(s.skip&&s.skip())return tourGo(i+dir,dir);if(s.el&&!tourEls(s).length&&!s.wait)return tourGo(i+dir,dir);
if(s.enter)s.enter();T.i=i;const els=tourEls(s);if(els[0]&&!s.fixed){const r=els[0].getBoundingClientRect();if(r.top<70||r.bottom>innerHeight-90)els[0].scrollIntoView({block:'center'})}
const n=T.steps.filter(x=>!x.center||x.count).length,k=T.steps.slice(0,i+1).filter(x=>!x.center||x.count).length,b=T.r.querySelector('.tbub');
b.innerHTML=`<div class="tprog">${T.o.name?`<span>${esc(T.o.name)}</span>`:''}<span>${t('{0} de {1}',Math.max(1,k),n)}</span></div><h3>${tq(s.title)}</h3><p>${tq(s.text)}</p>
<div class="tbtns"><button type="button" class="l" data-a="end">${t('Salir')}</button><span style="flex:1"></span>${i&&!s.noBack?`<button type="button" class="l" data-a="back">‹ ${t('Atrás')}</button>`:''}
${s.wait?(s.skipTo?`<button type="button" class="l lk" data-a="skip">${t('Saltar este paso')}</button>`:''):`<button type="button" class="p" data-a="next">${i==T.steps.length-1?t('Terminar'):t('Siguiente')} ›</button>`}</div>`;
b.classList.remove('pop');void b.offsetWidth;b.classList.add('pop');T.r.classList.toggle('free',!!(s.free||s.wait));T.r.classList.toggle('wait',!!s.wait);tourPos();
const nb=b.querySelector('[data-a=next]');if(nb&&isPC())nb.focus({preventScroll:true})}
function tourTick(){const T=TOUR;if(!T)return;const s=T.steps[T.i];if(!s)return;if(s.need&&!document.querySelector(s.need)){const j=T.steps.findIndex(x=>x.id==s.alt);if(j>T.i)return tourGo(j,1)}
if(s.wait&&s.wait())return tourGo(T.i+1,1);tourPos()}
function tourPos(){const T=TOUR;if(!T)return;const s=T.steps[T.i];if(!s)return;const sp=T.r.querySelector('.tspot'),b=T.r.querySelector('.tbub'),els=s.center?[]:tourEls(s),W=innerWidth,H=innerHeight,m=16;
let R=null;if(els.length){const rs=els.map(e=>e.getBoundingClientRect());R={l:Math.min(...rs.map(r=>r.left)),t:Math.min(...rs.map(r=>r.top)),r:Math.max(...rs.map(r=>r.right)),b:Math.max(...rs.map(r=>r.bottom))};
const p=s.pad??6;R={l:Math.max(4,R.l-p),t:Math.max(4,R.t-p),r:Math.min(W-4,R.r+p),b:Math.min(H-4,R.b+p)}}
Object.assign(sp.style,R?{left:R.l+'px',top:R.t+'px',width:R.r-R.l+'px',height:R.b-R.t+'px',opacity:1}:{left:W/2+'px',top:H/2+'px',width:0,height:0});sp.classList.toggle('none',!R);
const bw=Math.min(380,W-2*m),bh=b.offsetHeight;b.style.width=bw+'px';let top,left;
// Dentro de un formulario, en la PC el globo va al costado para no tapar los campos que siguen
const fo=els[0]&&els[0].closest('.ov form'),fr=fo&&isPC()&&fo.getBoundingClientRect(),sideL=fr&&(W-fr.right>=bw+2*m?fr.right+m:fr.left>=bw+2*m?fr.left-bw-m:null);
if(!R){top=(H-bh)/2;left=(W-bw)/2}else if(sideL!=null&&sideL!==false){left=sideL;top=(R.t+R.b)/2-bh/2}else{left=Math.min(Math.max(m,(R.l+R.r)/2-bw/2),W-bw-m);
if(H-R.b>=bh+m+8)top=R.b+12;else if(R.t>=bh+m+8)top=R.t-bh-12;else if(R.r+bw+2*m<=W&&isPC()){left=R.r+m;top=Math.min(Math.max(m,R.t),H-bh-m)}else top=(R.t+R.b)/2>H/2?m:H-bh-m}
b.style.left=left+'px';b.style.top=Math.max(m,Math.min(top,H-bh-m))+'px'}
function tourEnd(silent,done){const T=TOUR;if(!T)return;clearInterval(T.tick);removeEventListener('resize',tourPos);removeEventListener('scroll',tourPos,true);T.r.remove();document.body.classList.remove('touring');TOUR=null;
if(!silent&&T.o.onEnd)T.o.onEnd(!!done)}
document.addEventListener('keydown',e=>{if(!TOUR||e.target.closest&&e.target.closest('input,select,textarea'))return;const s=TOUR.steps[TOUR.i];
if(e.key=='Escape')tourEnd();else if((e.key=='ArrowRight'||e.key=='Enter')&&s&&!s.wait){e.preventDefault();tourGo(TOUR.i+1,1)}else if(e.key=='ArrowLeft')tourGo(TOUR.i-1,-1)});

// ——— Recorrido general ———
const addEl=()=>isPC()?'#side .add':'#bnav .add',navEl=()=>isPC()?'#side .it.main-only':'#bnav button:not(.add)',menuEl=()=>isPC()?'#side .it.mn':'#top .burger';
const inForm=s=>()=>{const e=$('.ov form [name='+s+']');return e&&(e.type=='hidden'?e.parentNode:e)};
function mainTour(){if(isPC()&&document.body.classList.contains('collapsed'))setCol(false);const n0=S.movs.length,F='.ov form [name=amount]';
tour([
{v:'res',center:1,title:t('Bienvenido a FNz 👋'),text:t('Te muestro en un minuto cómo funciona. Podés salir cuando quieras y repetirlo desde Configuración.')},
{v:'res',el:'#app .hero',title:t('Tu plata disponible'),text:t('Es lo que tenés hoy en tus billeteras, todo sumado. Lo que guardes en cajas de ahorro se muestra aparte, abajo.')},
{v:'res',el:'#app .top4 > .card:not(.hero)',title:t('Tus billeteras'),text:t('Cada lugar donde tenés plata: efectivo, Mercado Pago, dólares… Si un saldo no coincide con la realidad, tocá “Corregir saldo” y listo.')},
{v:'res',id:'add',el:addEl,fixed:1,wait:()=>!!$(F),skipTo:'after',title:t('Cargá tu primer gasto'),text:t('Cada vez que gastás o cobrás, lo anotás acá. 👉 Tocá “+ Cargar” para probar.'),enter:()=>{if(!isPC())scrollTo(0,0)}},
{need:F,alt:'after',free:1,noBack:1,el:'.ov .seg',title:t('¿Qué querés anotar?'),text:t('Gasto, ingreso, ahorro, retiro de una caja o pase entre billeteras. Para probar, dejá “Gasto”.')},
{need:F,alt:'after',free:1,el:inForm('amount'),title:t('El monto'),text:t('Escribí cuánto gastaste. Los puntos y la coma se ponen solos.')},
{need:F,alt:'after',free:1,el:inForm('src'),title:t('Con qué pagaste'),text:t('La billetera de donde sale la plata. Tocá para abrir la lista, o mantené apretado y deslizá hasta la opción y soltá.')},
{need:F,alt:'after',free:1,el:inForm('category'),title:t('Categoría'),text:t('Para qué fue: comida, transporte, servicios… Así después ves en qué se te va la plata.')},
{need:F,alt:'after',free:1,el:inForm('importance'),title:t('Prioridad'),text:t('¿Era necesario, útil o un gusto? Te ayuda a ver dónde podés recortar.')},
{need:F,alt:'after',el:'.ov form > button.p',wait:()=>!$(F),title:t('Guardalo'),text:t('👉 Tocá “Guardar”. Si preferís no cargar nada ahora, tocá “Cancelar”.')},
{v:'res',id:'after',center:1,count:1,noBack:1,title:()=>S.movs.length>n0?t('¡Bien! 🎉'):t('Para cuando quieras'),text:()=>S.movs.length>n0?t('Cargaste tu primer movimiento: ya se descontó de la billetera y aparece en el análisis.'):t('Cuando hagas tu primer gasto, tocá “+ Cargar”. Es lo que más vas a usar.')},
{v:'res',el:'#app .perbar',title:t('Análisis'),text:t('Elegí un período (este mes, el pasado, el año o fechas a mano) y mirá cuánto entró, cuánto gastaste, cuánto ahorraste y en qué se fue.')},
{v:'res',el:'#app .kpis',title:t('Los números del período'),text:t('Si no entendés un número, tocá su título y te lo explica.')},
{el:navEl,fixed:1,title:t('Las secciones'),text:t('📊 Resumen: lo que acabás de ver. 🗓️ Semanas: tus movimientos semana a semana, con filtros. 🐷 Ahorros: cajas para separar plata. 📆 Cuotas: compras en cuotas que se descuentan solas.')},
{v:'aho',goal:null,el:()=>S.goals.length?[...document.querySelectorAll('#app .gcards > .card')]:$('#app .row .p'),title:t('Ahorros 🐷'),text:()=>S.goals.length?t('Acá están tus cajas de ahorro. Tocá una para aportar, retirar o ver cuánto te falta para la meta.'):t('Todavía no tenés ahorros, ¡y está perfecto! Cuando quieras separar plata para algo (un viaje, emergencias…), creá una caja con este botón y andá aportando.')},
{v:'aho',goal:null,el:'#app h1 .hq',title:t('¿Dudas? Tocá ?'),text:t('Cada sección tiene este botón: te muestra una visita guiada de esa parte, con lo que hace cada cosa.')},
{el:menuEl,fixed:1,title:t('El menú'),text:t('Billeteras, monedas, categorías, prioridades, configuración y tu cuenta. Ahí adaptás la app a tu manera.')},
{v:'res',el:'#pasos',title:t('Primeros pasos'),text:t('Te dejé esta lista para que vayas probando la app. Se va tildando sola a medida que hacés cada cosa.')},
{v:'res',center:1,count:1,title:t('¡Listo! 🚀'),text:t('Ya sabés lo básico. Podés repetir este recorrido desde Menú → Configuración → Reiniciar tutorial de inicio.')}
],{onEnd:done=>{setQ('tour','hecho');render(1);if(!done)toast(t('Podés ver el recorrido cuando quieras desde Configuración.'))}})}

// ——— Visitas guiadas por sección (botón ?) ———
const gKey=()=>S.view=='aho'&&S.goal?'meta':S.view;
const GUIAS={
res:()=>[{el:'#app .hero',title:t('Disponible'),text:t('La plata que tenés hoy en tus billeteras. Debajo ves lo que hay en cajas de ahorro y el total de todo.')},
{el:'#app .top4 > .card:not(.hero)',title:t('Billeteras'),text:t('El saldo de cada billetera. Con “Corregir saldo” ponés cuánto tenés realmente y la app anota la diferencia, sin contarla como gasto ni ingreso.')},
{el:'#app .perbar',title:t('Período'),text:t('Por defecto ves todo el historial. Elegí un período rápido o fechas a mano para analizar solo esa parte.')},
{el:'#app .kpis',title:t('Indicadores'),text:t('Ingresos, gastos, lo ahorrado, qué porcentaje de lo que entra ahorrás, tu gasto diario y la comparación con el período anterior. Tocá cada título para ver la explicación.')},
{el:'#app .cols > div:first-child',title:t('Gráficos'),text:t('En qué categorías, con qué prioridad y desde qué billetera gastás. Lo más grande arriba.')},
{el:'#app .cols > div:last-child',title:t('Últimos movimientos'),text:t('Lo último que cargaste en el período. Desde cada uno lo podés editar o borrar.')},
{el:'#app > .row .lk',title:t('Exportar a Excel'),text:t('Bajá tus movimientos filtrados a un Excel, con un resumen por mes y por categoría.')}],
sem:()=>[{el:'#app .row.card',title:t('Elegí la semana'),text:t('Las semanas van de viernes a jueves. Con las flechas pasás a la anterior o la siguiente.')},
{el:'#app .hero',title:t('Resultado de la semana'),text:t('Cuánto cambió tu plata disponible esta semana: lo que entró menos lo que gastaste y ahorraste.')},
{el:'#app .cols > div:first-child > .grid',title:t('Billeteras al cierre'),text:t('Cuánto quedó en cada billetera al terminar la semana y cuánto subió o bajó.')},
{el:'#app details.card',title:t('Filtros'),text:t('Buscá por tipo, monto, billetera o texto. Tildá “Buscar en todas las semanas” para buscar en todo tu historial.')},
{el:'#lst',title:t('Movimientos'),text:t('Todo lo que cargaste esta semana. Tocá “editar” para corregir algo o “borrar” para sacarlo.')}],
aho:()=>[{el:'#app > .row .p',title:t('Nueva caja'),text:t('Una caja de ahorro es plata separada para un objetivo: un viaje, el auto, un fondo de emergencia. Puede tener una meta y guardar varias monedas.')},
{el:'#app .hero',title:t('Total ahorrado'),text:t('La suma de todas tus cajas.')},
{el:'#app .gcards > .card',title:t('Tus cajas'),text:t('Cada caja muestra cuánto tiene y cuánto le falta para la meta. Tocá una para entrar y aportar o retirar.')},
{center:1,title:t('Cómo se ahorra'),text:t('Aportar pasa plata de una billetera a la caja: deja de estar “disponible” pero sigue siendo tuya. Retirar la devuelve a una billetera.')}],
meta:()=>[{el:'#app .hero',title:t('Total de la caja'),text:t('Cuánto hay en esta caja y, si tiene meta, qué porcentaje llevás y cuánto falta.')},
{el:'#app .cols > div:first-child > .grid',title:t('Aportar y retirar'),text:t('Aportar: pasa plata de una billetera a esta caja. Retirar: la devuelve a una billetera.')},
{el:'#app [onclick^="openForm(\'cambio\'"]',title:t('Cambiar moneda'),text:t('Si la caja guarda varias monedas, pasás saldo de una a otra indicando a qué cambio lo hiciste.')},
{el:'#app .kpis',title:t('Tu ritmo'),text:t('Cuánto aportás por semana en promedio y en cuántas semanas llegarías a la meta a ese ritmo.')},
{el:'#app .cols > div:first-child > .row',title:t('Editar la caja'),text:t('Cambiale el nombre, la meta o las monedas que guarda.')},
{el:'#app .cols > div:last-child',title:t('Movimientos de la caja'),text:t('Cada aporte, retiro y gasto pagado con esta caja.')}],
cuo:()=>[{el:'#app > .row .p',title:t('Nuevo plan'),text:t('¿Compraste algo en cuotas? Cargá el plan una vez (monto, cantidad y fecha de la primera) y la app descuenta cada cuota sola cuando vence.')},
{el:'#app .kpis',title:t('Lo que viene'),text:t('Cuánto vas a pagar en cuotas en los próximos 30 días y cuánto te falta pagar en total.')},
{el:'#app .gcards > .card',title:t('Tus planes'),text:t('El avance de cada plan, la próxima cuota y cuándo termina.')}],
bil:()=>[{el:'#app > .row .p',title:t('Nueva billetera'),text:t('Creá una por cada lugar donde tenés plata: efectivo, banco, Mercado Pago, tarjeta prepaga… Cada una trabaja en una moneda.')},
{el:'#app .gcards',title:t('Tus billeteras'),text:t('Con “Editar” cambiás nombre, ícono y color. Las que ya tienen movimientos no se borran: se archivan, y dejan de aparecer al cargar.')}],
mon:()=>[{el:'#app > .row .p',title:t('Nueva moneda'),text:t('Agregá dólares, euros o la que uses. Después creás una billetera en esa moneda.')},
{el:'#app .gcards',title:t('Cotizaciones'),text:t('Cuántos pesos vale cada moneda. Se usa para sumar todo junto y como sugerencia cuando pasás plata de una moneda a otra; en ese momento siempre podés poner el cambio real.')}],
cat:()=>[{el:'#app > .row .p',title:t('Nueva categoría'),text:t('Las categorías ordenan tus gastos e ingresos: comida, transporte, sueldo… Creá las que te sirvan.')},
{el:'#app .cols',title:t('Gastos e ingresos'),text:t('Cada lista tiene su “+ Agregar”. Elegí ícono y color: así se ven en los gráficos. Si renombrás una, se actualizan sus movimientos.')}],
pri:()=>[{el:'#app > .row .p',title:t('Nueva prioridad'),text:t('La prioridad dice qué tan necesario fue un gasto. Vienen Necesario, Útil y Gusto, y podés crear las tuyas.')},
{el:'#app .card.narrow',title:t('Tus prioridades'),text:t('En el Resumen ves cuánto gastás en cada una: ideal para saber dónde recortar.')}],
cfg:()=>[{el:'#app .narrow > .card:first-of-type',title:t('Idioma'),text:t('Español o inglés.')},
{el:'#app .themes',title:t('Tema'),text:t('Los colores de la app: claro, oscuro, medianoche o crema.')},
{el:'#cfgtot',title:t('Cómo ver los totales'),text:t('Si tenés varias monedas, elegí si querés todo convertido a una, separado por moneda, o las dos cosas.')},
{el:'#cfgtut',title:t('Tutorial'),text:t('Repetí el tutorial de inicio cuando quieras, o mostrá de nuevo la lista de primeros pasos.')}],
cta:()=>[{el:'#app .narrow > form.card',title:t('Usuario y contraseña'),text:t('Cambiá tu usuario o tu contraseña. Siempre te pide la contraseña actual.')},
{el:'#app .narrow > .card:last-of-type',title:t('Formatear cuenta'),text:t('Si querés empezar de cero, elegí qué borrar. Te pide la contraseña y una palabra para que no pase por accidente.')}]};
const GN={res:'Resumen',sem:'Semanas',aho:'Ahorros',meta:'Caja de ahorro',cuo:'Cuotas',bil:'Billeteras',mon:'Monedas',cat:'Categorías',pri:'Prioridades',cfg:'Configuración',cta:'Cuenta'};
function guia(){const k=gKey(),g=GUIAS[k];if(!g)return;const v=S.view,gl=S.goal;tour(g().map(s=>({v,goal:v=='aho'?gl:undefined,...s})),{name:t(GN[k]),onEnd:done=>{if(done)pvAdd('guia')}})}
const hqB=()=>GUIAS[gKey()]?`<button type="button" class="hq" onclick="guia()" title="${t('Visita guiada de esta sección')}" aria-label="${t('Visita guiada de esta sección')}">?</button>`:'';

// ——— Tarjetas del Resumen: oferta del recorrido (usuarios que ya existían) y "Primeros pasos" ———
const PASOS=[['gasto','Cargá tu primer gasto',()=>S.movs.some(x=>x.type=='egreso'),"openForm('egreso')"],['ingreso','Anotá un ingreso (sueldo, un cobro…)',()=>S.movs.some(x=>x.type=='ingreso'),"openForm('ingreso')"],
['caja','Creá una caja de ahorro',()=>S.goals.length>0,"go('aho');goalForm()"],['sem','Mirá tus semanas',()=>pvHas('sem'),"go('sem')"],['cat','Revisá tus categorías',()=>pvHas('cat'),"go('cat')"],['guia','Probá una visita guiada (botón ?)',()=>pvHas('guia'),'guia()']];
async function offerTour(y){if(y){await setQ('pasos','on');await setQ('tour','hecho');render(1);mainTour()}else{await setQ('tour','hecho');render(1);toast(t('Podés ver el recorrido cuando quieras desde Configuración.'))}}
async function hidePasos(){await setQ('pasos','off');render(1);toast(t('Podés volver a mostrarla desde Configuración.'))}
function onbCards(){let h='';if(S.settings.tour=='ofrecer'&&!TOUR)h+=`<div class="card onb"><div class="oic">🧭</div><div style="flex:1"><b>${t('¿Querés un recorrido por la app?')}</b><div class="mut">${t('En un minuto te muestro cómo sacarle el jugo, con todas las novedades.')}</div>
<div class="obtn"><button class="p" onclick="offerTour(1)">${t('Ver recorrido')}</button><button class="l" onclick="offerTour(0)">${t('No, gracias')}</button></div></div></div>`;
if(S.settings.pasos!='on')return h;const st=PASOS.map(([k,n,f,a])=>({k,n,ok:f(),a})),c=st.filter(x=>x.ok).length,all=c==st.length;
return h+`<div class="card pasos" id="pasos"><div class="row"><b>🚀 ${all?t('¡Completaste los primeros pasos!'):t('Primeros pasos')}</b><button class="l" onclick="hidePasos()" aria-label="${t('Ocultar')}" title="${t('Ocultar')}">✕</button></div>
<div class="bar"><i style="width:${c/st.length*100}%;background:var(--in)"></i></div><div class="mut">${t('{0} de {1}',c,st.length)}</div>
${all?`<p>${t('Ya conocés toda la app. ¡A ordenar esas finanzas!')}</p><button class="p" onclick="hidePasos()">${t('Cerrar')}</button>`:`<div class="plist">${st.map(x=>`<button type="button" class="pi${x.ok?' ok':''}" ${x.ok?'disabled':`onclick="${x.a}"`}><span class="pck">${x.ok?'✓':''}</span>${t(x.n)}${x.ok?'':'<span class="chev">›</span>'}</button>`).join('')}</div>`}</div>`}
