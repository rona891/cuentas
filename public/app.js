// FNz: frontend sin build. Los textos pasan por t(): el español es la clave y i18n.js tiene el inglés.
const p2=x=>String(x).padStart(2,'0'),ds=d=>`${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`,D=s=>new Date(s+'T12:00:00');
const today=()=>ds(new Date()),addD=(s,n)=>{const d=D(s);d.setDate(d.getDate()+n);return ds(d)},wk=s=>addD(s,-((D(s).getDay()+2)%7)); // semanas desde el viernes
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const store=(k,v)=>{try{return v===undefined?localStorage.getItem(k):localStorage.setItem(k,v)}catch{return null}};
let L=store('lang')||'es';
const t=(s,...a)=>{let r=(L=='en'&&EN[s])||s;a.forEach((v,i)=>r=r.split('{'+i+'}').join(v));return r};
const LOC=()=>L=='en'?'en-US':'es-AR',fdate=(s,o)=>D(s).toLocaleDateString(LOC(),o);
const api=async(p,m='GET',b)=>{const r=await fetch('/api/'+p,{method:m,headers:{'Content-Type':'application/json'},body:b?JSON.stringify(b):undefined});const j=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(new Error(t(j.error||'Error')),{st:r.status});return j};
let S={f:{types:[],min:'',max:'',wallet:'',q:'',all:false},view:'res',movs:[],goals:[],plans:[],currencies:[],wallets:[],categories:[],priorities:[],settings:{},username:'',from:'',to:'',week:wk(today()),goal:null,reg:false};

// Monedas: rate = cuántos pesos (moneda base) vale 1 unidad. money() formatea en la moneda indicada (por defecto, la base).
const BASE=()=>S.currencies.find(c=>c.base)||{id:0,code:'ARS',symbol:'$',rate:1,base:1,name:'Peso argentino'};
const CUR=id=>S.currencies.find(c=>c.id==id)||BASE(),conv=(v,f,to)=>v*CUR(f).rate/CUR(to).rate;
const TCUR=()=>CUR(S.settings.tcur).id,MODE=()=>S.settings.totals||'ambos',multi=()=>new Set(S.wallets.map(w=>w.currency_id).concat(S.goals.flatMap(gcs))).size>1;
const money=(n,cid)=>{const c=CUR(cid),v=Math.abs(n),d=c.base||v>=1000?0:2;return(n<0?'-':'')+c.symbol+(c.symbol.length>1?' ':'')+v.toLocaleString(LOC(),{maximumFractionDigits:d,minimumFractionDigits:d&&v%1?2:0})};
const WAL=id=>S.wallets.find(w=>w.id==id),AW=()=>S.wallets.filter(w=>!w.archived),wcur=id=>(WAL(id)||{}).currency_id||BASE().id;
const gcs=g=>String(g.currencies||g.currency_id).split(',').filter(Boolean).map(Number);
// Moneda de x.amount y valor convertido a la moneda de los totales
const mcur=x=>x.wallet_id?wcur(x.wallet_id):x.goal_cur||BASE().id,vT=x=>conv(x.amount,mcur(x),TCUR());

// Apariencia e idioma
const THEMES=[['claro','Claro',['#F2F4FA','#5B4FE0','#0E9F6E','#E5484D']],['oscuro','Oscuro',['#111318','#8B83F7','#34D399','#F87171']],['medianoche','Medianoche',['#060A18','#22D3EE','#A78BFA','#FB7185']],['crema','Crema',['#F6EFE2','#B45309','#3F7D20','#B42318']]];
function applyTheme(th){document.documentElement.dataset.theme=th;store('theme',th);const m=$('meta[name=theme-color]');if(m)m.content=(THEMES.find(x=>x[0]==th)||THEMES[3])[2][0]}
function setLang(l){L=l;store('lang',l);document.documentElement.lang=l}
async function setS(k,v){S.settings[k]=v;if(k=='theme')applyTheme(v);if(k=='lang')setLang(v);render(1);try{S.settings=await api('settings','PUT',{[k]:v})}catch(e){toast(e.message)}}
function toast(m){const d=document.createElement('div');d.className='toast';d.textContent=m;document.body.appendChild(d);setTimeout(()=>d.remove(),2600)}

// Tipos de movimiento, categorías y utilidades de presentación
const TL={ingreso:'Ingreso',egreso:'Gasto',ahorro:'Ahorro',retiro:'Retiro',transferencia:'Pase',ajuste:'Corrección',cambio:'Cambio de moneda'},tl=k=>t(TL[k]);
const TI={ingreso:'💵',egreso:'🧾',ahorro:'🐷',retiro:'↩️',transferencia:'⇄',ajuste:'✎',cambio:'💱'},TC={ingreso:'var(--in)',egreso:'var(--out)',ahorro:'var(--sv)',retiro:'var(--sv)',transferencia:'var(--tr)',ajuste:'var(--aj)',cambio:'var(--tr)'};
const PAL=['#5B4FE0','#0E9F6E','#E5484D','#2F7BEA','#D97706','#C026D3','#0891B2','#65A30D','#DB2777','#7C3AED'];
const ICONS=['💵','💳','🏦','📱','👛','💰','🪙','💶','💷','💴','🐷','🍔','🛒','🚌','🚗','🏠','💡','💊','🎉','🛍️','📆','📦','💼','✨','🎁','✈️','🎓','🐶','👕','⚽','🎮','📚','🍺','☕','🏷️'];
const isImg=v=>typeof v=='string'&&v.startsWith('data:image/png;base64,'),icoH=v=>isImg(v)?`<img class="cico" src="${v}" alt="">`:esc(v),icoT=v=>isImg(v)?'▫️':v;
const PRX=n=>(S.priorities||[]).find(p=>p.name==n),prH=n=>{const p=PRX(n);return(p?icoH(p.icon)+' ':'')+esc(t(n))};
const CATX=n=>S.categories.find(c=>c.name==n),catH=n=>{const c=CATX(n);return(c?icoH(c.icon)+' ':'')+esc(t(n))};
const WN=id=>{const w=WAL(id);return w?w.name:''},wIc=id=>icoH((WAL(id)||{}).icon||'👛'),wCol=id=>(WAL(id)||{}).color||'var(--aj)';
const sum=(a,k)=>a.filter(x=>x.type==k).reduce((s,x)=>s+vT(x),0);
const tip=(l,x)=>`<span data-tip="${esc(x)}" tabindex="0">${l}</span>`;
const grp=(a,k)=>Object.entries(a.reduce((o,x)=>(o[x[k]||t('Sin dato')]=(o[x[k]||t('Sin dato')]||0)+vT(x),o),{})).sort((a,b)=>b[1]-a[1]);
const bars=(a,col=(k,i)=>PAL[i%PAL.length],lbl=k=>esc(k))=>{const m=a[0]?a[0][1]:1;return a.map(([k,v],i)=>`<div class="row"><span>${lbl(k)}</span><b>${money(v,TCUR())}</b></div><div class="bar"><i style="width:${v/m*100}%;background:${col(k,i)}"></i></div>`).join('')||`<p class="mut">${t('Sin datos todavía.')}</p>`};
const empty=(ic,m)=>`<div class="empty"><b>${ic}</b>${m}</div>`;
const picker=(name,opts,val,fn,extra='')=>`<input type="hidden" name="${name}" value="${esc(val)}"><div class="pick" data-for="${name}">${opts.map(o=>`<button type="button" data-v="${esc(o)}" class="${o==val?'on':''}">${fn(o)}</button>`).join('')}${extra}</div>`;
document.addEventListener('click',e=>{const b=e.target.closest('.pick button');if(!b)return;const p=b.parentNode;p.querySelectorAll('button,.cpick').forEach(x=>x.classList.toggle('on',x==b));p.previousElementSibling.value=b.dataset.v});
// Ícono: emojis + imágenes ya subidas + ＋ para subir un .ico/imagen (se achica a 64×64 PNG antes de guardarla)
const iconPick=val=>{const opts=[...new Set([...ICONS,...S.wallets.map(w=>w.icon),...S.categories.map(c=>c.icon),...(S.priorities||[]).map(p=>p.icon)].filter(v=>ICONS.includes(v)||isImg(v)).concat(val?[val]:[]))];
return picker('icon',opts,val,icoH,`<label class="padd" title="${t('Subir ícono (.ico o imagen)')}">＋<input type="file" accept=".ico,image/x-icon,image/png,image/jpeg,image/webp,image/gif" onchange="upIcon(this)" hidden></label>`)};
function upIcon(inp){const f=inp.files[0];inp.value='';if(!f)return;if(f.size>1e6)return toast(t('La imagen es muy grande (máx. 1 MB)'));const r=new FileReader();
r.onload=()=>{const im=new Image();im.onload=()=>{const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d'),k=Math.min(64/im.width,64/im.height),w=im.width*k,h=im.height*k;
x.drawImage(im,(64-w)/2,(64-h)/2,w,h);const d=c.toDataURL('image/png'),b=document.createElement('button');b.type='button';b.dataset.v=d;b.innerHTML=icoH(d);inp.parentNode.before(b);b.click()};
im.onerror=()=>toast(t('No se pudo leer la imagen'));im.src=r.result};r.readAsDataURL(f)}
// Color: paleta + selector libre del sistema
const colorPick=(val)=>{const own=!PAL.includes(val);return picker('color',PAL,val,c=>`<i style="background:${c}"></i>`,`<label class="cpick${own?' on':''}" title="${t('Color personalizado')}" style="--cc:${own?val:'transparent'}"><input type="color" value="${/^#[0-9a-fA-F]{6}$/.test(val)?val:'#5B4FE0'}" oninput="cusColor(this)"></label>`)};
function cusColor(i){const l=i.parentNode,p=l.parentNode;p.querySelectorAll('button').forEach(b=>b.classList.remove('on'));l.classList.add('on');l.style.setProperty('--cc',i.value);p.previousElementSibling.value=i.value}

// Saldos: billeteras en su moneda; cajas con un saldo por moneda
const bal=(w,upTo)=>S.movs.reduce((s,x)=>{if(x.date>upTo)return s;const a=x.amount;
if(x.type=='transferencia')return s+(x.to_wallet_id==w?x.amount2??a:0)-(x.wallet_id==w?a:0);if(x.wallet_id!=w)return s;
return s+(x.type=='ingreso'||x.type=='ajuste'?a:-a)},0);
function gbal(g,upTo='9999'){const r=Object.fromEntries(gcs(g).map(c=>[c,0]));for(const x of S.movs){if(x.goal_id!=g.id||x.date>upTo)continue;const c=x.goal_cur||g.currency_id;
if(x.type=='ahorro')r[c]=(r[c]||0)+(x.amount2??x.amount);else if(x.type=='egreso')r[c]=(r[c]||0)-x.amount;else if(x.type=='cambio'){r[c]=(r[c]||0)-x.amount;r[x.goal_cur2]=(r[x.goal_cur2]||0)+x.amount2}else if(x.type=='ajuste')r[c]=(r[c]||0)+x.amount}return r}
const curSum=o=>Object.entries(o).filter(([,v])=>Math.abs(v)>0.004);
const tot=(o,to)=>curSum(o).reduce((s,[c,v])=>s+conv(v,c,to),0);
const breakdown=o=>curSum(o).map(([c,v])=>money(v,c)).join(' · ');

// Botón para ver/ocultar la contraseña en cualquier campo de contraseña
const EYE_ON='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
const EYE_OFF='<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M17.9 17.9A10.4 10.4 0 0 1 12 19c-6.5 0-10-7-10-7a18.6 18.6 0 0 1 4.1-5.1M9.9 5.2A9.6 9.6 0 0 1 12 5c6.5 0 10 7 10 7a18.5 18.5 0 0 1-2.2 3.2M14.1 14.1a3 3 0 1 1-4.2-4.2M2 2l20 20"/></svg>';
const EYE=()=>`<button type="button" class="eye" aria-label="${t('Mostrar contraseña')}" title="${t('Mostrar contraseña')}">${EYE_ON}</button>`;
document.addEventListener('click',e=>{const b=e.target.closest('.pw .eye');if(!b)return;const i=b.previousElementSibling,show=i.type=='password';i.type=show?'text':'password';
b.innerHTML=show?EYE_OFF:EYE_ON;b.title=b.ariaLabel=show?t('Ocultar contraseña'):t('Mostrar contraseña');i.focus()});
// Carga, login y estructura
async function load(){try{Object.assign(S,await api('data'));setLang(S.settings.lang||'es');applyTheme(S.settings.theme||'crema');
if(await genCuotas()>0)Object.assign(S,await api('data'));document.body.classList.remove('auth');render();tourBoot()}catch(e){if(e.st==401)loginView();else toast(e.message)}}
function loginView(){document.body.classList.add('auth');['#top','#side','#bnav'].forEach(s=>$(s).innerHTML='');
$('#app').innerHTML=`<div style="text-align:center;margin:40px 0 18px"><div style="font-size:44px">💸</div><h1 style="margin:6px 0 2px">FNz</h1><div class="mut">${t('Tus finanzas, claras.')}</div></div>
<form class="card" onsubmit="auth(event)"><label>${t('Usuario')}</label><input name="u" autocomplete="username" required>
<label>${t('Contraseña')}</label><div class="pw"><input name="p" type="password" autocomplete="${S.reg?'new-password':'current-password'}" required>${EYE()}</div><p class="err" id="e"></p>
<button class="p">${S.reg?t('Crear cuenta'):t('Entrar')}</button><button type="button" class="l" style="width:100%" onclick="S.reg=!S.reg;loginView()">${S.reg?t('Ya tengo cuenta'):t('Crear una cuenta')}</button></form>
<div class="seg" style="max-width:200px;margin:12px auto">${[['es','Español'],['en','English']].map(([k,n])=>`<button type="button" class="${L==k?'on':''}" onclick="setLang('${k}');loginView()">${n}</button>`).join('')}</div>`}
async function auth(e){e.preventDefault();const f=e.target;try{await api(S.reg?'register':'login','POST',{username:f.u.value,password:f.p.value});load()}catch(x){$('#e').textContent=x.message}}
async function logout(){await api('logout','POST').catch(()=>{});menu(0);tourEnd(1);TB=false;Object.assign(S,{movs:[],goals:[],plans:[],view:'res',goal:null});loginView()}
const MAIN=[['res','Resumen','📊'],['sem','Semanas','🗓️'],['aho','Ahorros','🐷'],['cuo','Cuotas','📆']],MENU=[['bil','Billeteras','👛'],['mon','Monedas','💱'],['cat','Categorías','🏷️'],['pri','Prioridades','🚦'],['cfg','Configuración','⚙️'],['cta','Cuenta','👤']];
function go(v){S.view=v;S.goal=null;menu(0);render();if(v=='sem'||v=='cat')pvAdd(v)}
function menu(o){$('#side').classList.toggle('open',!!o);const s=$('#scrim');if(o&&!s){const d=document.createElement('div');d.id='scrim';d.onclick=()=>menu(0);document.body.appendChild(d)}else if(!o&&s)s.remove()}
// PC: el panel se puede esconder; escondido, ☰ lo muestra flotando al pasar el mouse y con clic lo vuelve a fijar
function setCol(c){document.body.classList.toggle('collapsed',c);store('side',c?'0':'1');$('#side').classList.remove('peek');$('#side').innerHTML=side()}
function initSide(){const sd=$('#side'),b=$('#dburger');document.body.classList.toggle('collapsed',store('side')=='0');
b.onclick=()=>setCol(false);b.onmouseenter=()=>{if(document.body.classList.contains('collapsed')){sd.innerHTML=side();sd.classList.add('peek')}};sd.onmouseleave=()=>sd.classList.remove('peek')}
function side(){const it=c=>([k,n,i])=>`<button class="it ${c}${S.view==k?' on':''}" onclick="go('${k}')"><span>${i}</span>${t(n)}</button>`;
const col=document.body.classList.contains('collapsed');
return`<button class="pin" onclick="setCol(${!col})" title="${col?t('Fijar menú'):t('Ocultar menú')}" aria-label="${col?t('Fijar menú'):t('Ocultar menú')}">${col?'»':'«'}</button><div class="brand">💸 FNz</div><div class="who">${esc(S.username)}</div><button class="p add main-only" onclick="openForm()">＋ ${t('Cargar movimiento')}</button>
<div class="sec main-only">${t('Principal')}</div>${MAIN.map(it('main-only')).join('')}<div class="sec">${t('Menú')}</div>${MENU.map(it('mn')).join('')}
<div style="flex:1"></div><button class="it" onclick="logout()"><span>🚪</span>${t('Cerrar sesión')}</button>`}
const VIEWS={res:()=>resumen(),sem:()=>semana(),cuo:()=>cuotas(),bil:()=>billeteras(),mon:()=>monedas(),cat:()=>categorias(),pri:()=>prioridades(),cfg:()=>config(),cta:()=>cuenta(),aho:()=>S.goal?meta():ahorros()};
function render(keep){const v=S.view;
$('#top').innerHTML=`<button class="burger" onclick="menu(1)" aria-label="${t('Menú')}">☰</button><span class="brand">${t((MAIN.concat(MENU).find(x=>x[0]==v)||MAIN[0])[1])}</span>`;
$('#bnav').innerHTML=MAIN.map(([k,n,i])=>`<button class="${v==k?'on':''}" onclick="go('${k}')"><span>${i}</span>${t(n)}</button>`).join('')+`<button class="add" onclick="openForm()"><span>＋</span>${t('Cargar')}</button>`;
$('#side').innerHTML=side();$('#app').innerHTML=(VIEWS[v]||VIEWS.res)();const h=$('#app h1');if(h)h.insertAdjacentHTML('beforeend',hqB());if(!keep)scrollTo(0,0)}

// Resumen
const dd=(a,b)=>Math.round((D(b)-D(a))/864e5)+1,fdd=s=>fdate(s,{day:'numeric',month:'short',year:'numeric'});
const perR=k=>{const x=today(),y=+x.slice(0,4),m=+x.slice(5,7);return k=='m'?[x.slice(0,8)+'01',x]:k=='pm'?[ds(new Date(y,m-2,1)),ds(new Date(y,m-1,0))]:k=='y'?[y+'-01-01',x]:['','']};
function per(k){[S.from,S.to]=perR(k);render(1)}
function walletCard(w,v){const tc=TCUR(),eq=w.currency_id!=tc&&MODE()!='separado'?`<div class="mut">≈ ${money(conv(v,w.currency_id,tc),tc)}</div>`:'';
return`<div class="card"><div class="wal"><div class="ic" style="--wc:${w.color}">${icoH(w.icon)}</div><div><div class="mut">${esc(w.name)}${w.currency_id!=BASE().id?' · '+CUR(w.currency_id).code:''}</div><b style="font-size:20px">${money(v,w.currency_id)}</b>${eq}</div></div><button class="l lk" style="padding:6px 0 0" onclick="corr(${w.id})">${t('Corregir saldo')}</button></div>`}
// Disponible y ahorros por moneda, según cómo quiera ver los totales (ambos / separado / una moneda)
function heroTotals(){const x=today(),tc=TCUR(),m=MODE(),disp={},sav={};
S.wallets.forEach(w=>{disp[w.currency_id]=(disp[w.currency_id]||0)+bal(w.id,x)});S.goals.forEach(g=>{for(const[c,v]of Object.entries(gbal(g)))sav[c]=(sav[c]||0)+v});
const all={...disp};for(const[c,v]of Object.entries(sav))all[c]=(all[c]||0)+v;const several=curSum(disp).length>1;
const big=m=='separado'?(curSum(disp).map(([c,v])=>`<div class="big">${money(v,c)}</div>`).join('')||`<div class="big">${money(0)}</div>`):`<div class="big">${money(tot(disp,tc),tc)}</div>`;
const sub=m=='separado'?`<span>🐷 ${t('En ahorros')} <b>${breakdown(sav)||money(0)}</b></span>`:`<span>🐷 ${t('En ahorros')} <b>${money(tot(sav,tc),tc)}</b></span><span>Σ ${t('Total')} <b>${money(tot(all,tc),tc)}</b></span>`;
return`<div class="card hero"><div class="lbl">${tip(t('Disponible'),t('Lo que tenés hoy en tus billeteras, contando todo desde que empezaste. No incluye lo guardado en cajas de ahorro.')+(m!='separado'&&multi()?' '+t('Convertido a {0} con tus cotizaciones.',CUR(tc).code):''))}</div>${big}
${m=='ambos'&&several?`<div class="lbl">${breakdown(disp)}</div>`:''}<div class="sub">${sub}</div></div>`}
function resumen(){const F=S.from,To=S.to,x=today(),tc=TCUR(),M=S.movs.filter(m=>(!F||m.date>=F)&&(!To||m.date<=To)),ing=sum(M,'ingreso'),egr=sum(M,'egreso'),aho=sum(M,'ahorro');
const st=F||(S.movs.length?S.movs[S.movs.length-1].date:x),en=To&&To<x?To:x,dias=Math.max(1,dd(st,en));
const pe=F&&To?sum(S.movs.filter(m=>m.date>=addD(F,-dd(F,To))&&m.date<=addD(F,-1)),'egreso'):0,E=M.filter(m=>m.type=='egreso');
const dow=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'],byd=grp(E.map(m=>({...m,d:t(dow[D(m.date).getDay()])})),'d')[0];
const P=[['','Todo'],['m','Este mes'],['pm','Mes pasado'],['y','Este año']],pk=k=>{const[a,b]=perR(k);return a==F&&b==To};
const kpi=(l,h,v,c)=>`<div class="card kpi" style="--k:${c}"><div class="mut">${tip(t(l),t(h))}</div><div class="v" style="color:${c}">${v}</div></div>`,mo=v=>money(v,tc);
return`${onbCards()}<div class="row"><h1>${t('Resumen')}</h1><button class="l lk" onclick="openExport()">⬇ ${t('Exportar Excel')}</button></div>
<div class="top4" style="margin-bottom:10px">${heroTotals()}${AW().map(w=>walletCard(w,bal(w.id,x))).join('')}</div>
<h2>${t('Análisis')}${multi()?` <span class="tag">${t('en {0}',CUR(tc).code)}</span>`:''}</h2><div class="perbar"><div class="seg">${P.map(([k,n])=>`<button type="button" class="${pk(k)?'on':''}" onclick="per('${k}')">${t(n)}</button>`).join('')}</div>
<div><label>${t('Desde')}</label><input type="date" value="${F}" onchange="S.from=this.value;render(1)"></div><div><label>${t('Hasta')}</label><input type="date" value="${To}" onchange="S.to=this.value;render(1)"></div></div>
<p class="mut">${F||To?t('Del {0} al {1}',F?fdd(F):t('inicio'),To?fdd(To):t('hoy')):t('Todo el historial')}</p>
<div class="kpis">${kpi('Ingresos','Plata que entró en el período.',mo(ing),'var(--in)')}${kpi('Gastos','Lo que gastaste en el período, sin contar los ahorros.',mo(egr),'var(--out)')}
${kpi('Ahorrado','Lo que aportaste a tus cajas en el período, menos lo que retiraste.',mo(aho),'var(--sv)')}${kpi('Tasa de ahorro','Porcentaje de tus ingresos que fue a ahorro.',(ing?Math.round(aho/ing*100):0)+'%','var(--acc)')}
${kpi('Gasto diario prom.','Gastos del período divididos por los días transcurridos.',mo(egr/dias),'var(--tr)')}${kpi('vs. período anterior','Cuánto más o menos gastaste que en el período de igual duración inmediatamente anterior. Elegí desde y hasta para verlo.',pe?(egr>pe?'+':'')+Math.round((egr-pe)/pe*100)+'%':'—','var(--aj)')}</div>
${byd?`<p class="mut">${t('Día en que más gastás:')} <b>${byd[0]}</b></p>`:''}
<div class="cols"><div><h2>${t('Gastos por categoría')}</h2><div class="card">${bars(grp(E,'category'),(k,i)=>(CATX(k)||{}).color||PAL[i%PAL.length],catH)}</div><h2>${t('Gastos por prioridad')}</h2><div class="card">${bars(grp(E,'importance'),k=>(PRX(k)||{}).color||'var(--aj)',prH)}</div>
<h2>${t('Gastos por billetera')}</h2><div class="card">${bars(grp(E.map(m=>({...m,w:m.wallet_id?m.wallet_id:'c'})),'w'),k=>k=='c'?'var(--sv)':wCol(k),k=>k=='c'?'🐷 '+t('Caja de ahorro'):wIc(k)+' '+esc(WN(k)))}</div></div>
<div><h2>${t('Últimos movimientos')}</h2><div class="card">${M.slice(0,8).map(mvRow).join('')||empty('🗒️',t('Todavía no hay movimientos en este período.'))}</div>${M.length>8?`<button class="l lk" onclick="S.f.all=true;go('sem')">${t('Ver todos los movimientos')} →</button>`:''}</div></div>`}
function corr(id){const w=WAL(id),cur=bal(id,today());sheet(`<h2>${t('Corregir saldo de {0}',esc(w.name))}</h2><p class="mut">${t('Hoy la app dice {0}. Poné cuánto tenés realmente y se registra la diferencia, sin contar como ingreso ni gasto.',money(cur,w.currency_id))}</p>
<label>${t('Saldo real')} (${CUR(w.currency_id).code})</label>${mi('v',Math.round(cur*100)/100,{sym:CUR(w.currency_id).symbol+(CUR(w.currency_id).symbol.length>1?' ':''),neg:1,req:1})}`,async b=>{const d=Math.round((+b.v-cur)*100)/100;if(!d){toast(t('El saldo ya coincide.'));return}
await api('movements','POST',{type:'ajuste',amount:d,date:today(),wallet_id:id,detail:t('Corrección de saldo')});load()})}

// Semanas y lista de movimientos
function semana(){const a=S.week,b=addD(a,6),tc=TCUR(),W=S.movs.filter(x=>x.date>=a&&x.date<=b),ing=sum(W,'ingreso'),egr=sum(W,'egreso'),aho=sum(W,'ahorro'),aj=sum(W.filter(x=>!x.goal_id),'ajuste'),egW=sum(W.filter(x=>!x.goal_id),'egreso'),f=s=>fdate(s,{day:'numeric',month:'short'}),mo=v=>money(v,tc);
return`<h1>${t('Semana')}</h1><div class="cols"><div><div class="row card" style="padding:8px"><button class="l" onclick="S.week=addD(S.week,-7);render(1)">‹ ${t('Anterior')}</button><b>${f(a)} – ${f(b)}</b><button class="l" onclick="S.week=addD(S.week,7);render(1)">${t('Siguiente')} ›</button></div>
<div class="card hero"><div class="lbl">${tip(t('Resultado de la semana'),t('Cuánto cambió tu disponible: ingresos y correcciones menos gastos y ahorro de esta semana. No cuenta lo pagado con cajas de ahorro.'))}</div><div class="big">${mo(ing+aj-egW-aho)}</div>
<div class="sub"><span>${t('Ingresos')} <b>${mo(ing)}</b></span><span>${t('Gastos')} <b>${mo(egr)}</b></span><span>${t('Ahorro')} <b>${mo(aho)}</b></span>${aj?`<span>${t('Correcciones')} <b>${mo(aj)}</b></span>`:''}</div></div>
<div class="grid">${AW().map(w=>{const e=bal(w.id,b),d=e-bal(w.id,addD(a,-1));return`<div class="card"><div class="wal"><div class="ic" style="--wc:${w.color}">${icoH(w.icon)}</div><div><div class="mut">${tip(esc(w.name),t('Saldo al cierre de la semana. Arrastra lo de semanas anteriores.'))}</div><b>${money(e,w.currency_id)}</b><div class="mut">${d>=0?'+':'−'}${money(Math.abs(d),w.currency_id)} ${t('esta semana')}</div></div></div></div>`}).join('')}</div>
${filtros()}</div><div><h2>${t('Movimientos')}</h2><div id="lst">${lista()}</div></div></div>`}
async function del(id){if(await ask(t('¿Borrar este movimiento?'))){try{await api('movements/'+id,'DELETE');load()}catch(e){toast(e.message)}}}
function edit(id){const x=S.movs.find(x=>x.id==id);if(x)openForm(null,null,x)}
function mvRow(x){const g=S.goals.find(g=>g.id==x.goal_id),ret=x.type=='ahorro'&&x.amount<0,k=ret?'retiro':x.type,inCaja=S.view=='aho'&&S.goal,gc=x.goal_cur||(g&&g.currency_id);
const sg=x.type=='transferencia'||x.type=='cambio'?'':inCaja?((x.type=='ahorro'||x.type=='ajuste')&&x.amount>0?'+':'−'):(x.type=='ingreso'||(x.type=='ajuste'&&x.amount>0)||ret)?'+':'−';
const gn=g?'🐷 '+esc(g.name):'',wn=x.wallet_id?wIc(x.wallet_id)+' '+esc(WN(x.wallet_id)):'';
const tags=x.type=='cambio'?[gn,CUR(x.goal_cur).code+' → '+CUR(x.goal_cur2).code]:g?(x.type=='egreso'?[t('desde {0}',gn)]:ret?[gn,'→ '+wn]:[wn,'→ '+gn]):[x.type=='transferencia'?wn+' → '+wIc(x.to_wallet_id)+' '+esc(WN(x.to_wallet_id)):wn,x.category&&catH(x.category),x.importance&&prH(x.importance)];
// Con cambio de moneda se muestran los dos lados: lo que sale y lo que entra
const c2=x.type=='transferencia'?wcur(x.to_wallet_id):x.type=='cambio'?x.goal_cur2:x.type=='ahorro'?gc:null,two=x.amount2!=null&&c2;
const main=ret&&two?money(Math.abs(x.amount2),gc)+' → '+money(Math.abs(x.amount),mcur(x)):money(Math.abs(x.amount),mcur(x))+(two?' → '+money(Math.abs(x.amount2),c2):'');
return`<div class="mv" style="--c:${TC[k]}"><div class="ic">${TI[k]}</div><div class="tx"><div class="kind">${tl(k)}</div><div>${esc(x.detail||(x.type=='transferencia'?t('Pase de billetera'):x.category&&t(x.category))||(g?(ret?t('Retiro de ahorro'):x.type=='cambio'?tl('cambio'):t('Ahorro')):tl(k)))}</div>
<div class="mut">${fdate(x.date,S.f.all&&S.view=='sem'||S.view=='res'?{weekday:'short',day:'numeric',month:'short',year:'2-digit'}:{weekday:'short',day:'numeric'})} ${tags.filter(Boolean).map(s=>`<span class="tag">${s}</span>`).join(' ')}</div></div>
<div class="am"><b style="color:var(--c)">${sg}${main}</b><br><button class="l" onclick="edit(${x.id})">${t('editar')}</button><button class="l" onclick="del(${x.id})">${t('borrar')}</button></div></div>`}
const fAct=()=>{const f=S.f;return f.all||f.types.length||f.min!==''||f.max!==''||f.wallet||f.q.trim()},upL=()=>{const e=$('#lst');if(e)e.innerHTML=lista()};
const fm=x=>{const f=S.f,q=f.q.trim().toLowerCase(),a=Math.abs(x.amount);return(!f.types.length||f.types.includes(x.type))&&(f.min===''||a>=+f.min)&&(f.max===''||a<=+f.max)&&(!f.wallet||x.wallet_id==f.wallet||x.to_wallet_id==f.wallet)&&(!q||[x.detail,x.category,x.importance].join(' ').toLowerCase().includes(q))};
function fT(k){const x=S.f.types;S.f.types=x.includes(k)?x.filter(y=>y!=k):[...x,k];render(1)}
function lista(){const base=S.f.all?S.movs:S.movs.filter(x=>x.date>=S.week&&x.date<=addD(S.week,6)),r=base.filter(fm);
return`${fAct()?`<p class="mut">${t('Mostrando {0} de {1} movimientos',r.length,base.length)}${S.f.all?' '+t('(todas las semanas)'):''}</p>`:''}<div class="card">${r.map(mvRow).join('')||(base.length?empty('🔎',t('Ningún movimiento coincide con los filtros.')):empty('🗒️',t('Sin movimientos. Tocá “+ Cargar” para agregar tu cobro.')))}</div>`}
function filtros(){const f=S.f;
return`<details ${S.fo||fAct()?'open':''} ontoggle="S.fo=this.open" class="card"><summary><b>${t('Filtros')}</b>${fAct()?` <span class="tag">${t('activos')}</span>`:''}</summary>
<div class="seg" style="margin-top:10px">${['ingreso','egreso','ahorro','transferencia','ajuste'].map(k=>`<button type="button" class="${f.types.includes(k)?'on':''}" onclick="fT('${k}')">${tl(k)}</button>`).join('')}</div>
<div class="grid"><div><label>${t('Monto mínimo')}</label>${mi('',f.min,{attrs:'oninput="S.f.min=pmEl(this);upL()"'})}</div><div><label>${t('Monto máximo')}</label>${mi('',f.max,{attrs:'oninput="S.f.max=pmEl(this);upL()"'})}</div></div>
<label>${t('Billetera')}</label><select onchange="S.f.wallet=this.value;upL()"><option value="">${t('Todas')}</option>${S.wallets.map(w=>`<option value="${w.id}" ${f.wallet==w.id?'selected':''}>${icoT(w.icon)} ${esc(w.name)}</option>`).join('')}</select>
<label>${t('Buscar en detalle o categoría')}</label><input value="${esc(f.q)}" oninput="S.f.q=this.value;upL()">
<label class="ck" style="margin-top:12px"><input type="checkbox" ${f.all?'checked':''} onchange="S.f.all=this.checked;upL()"> ${t('Buscar en todas las semanas')}</label>
<button type="button" class="l lk" onclick="S.f={types:[],min:'',max:'',wallet:'',q:'',all:false};render(1)">${t('Limpiar filtros')}</button></details>`}

// Ahorros: cada caja tiene una moneda principal (meta y total) y puede guardar saldo en otras monedas habilitadas
function gst(g){const A=S.movs.filter(x=>x.goal_id==g.id),pc=g.currency_id,B=gbal(g),tt=tot(B,pc),side=x=>conv(x.amount2??x.amount,x.goal_cur||pc,pc);
const dec=A.filter(x=>x.type=='egreso'&&x.dec_target).reduce((s,x)=>s+conv(x.amount,x.goal_cur||pc,pc),0),tgt=Math.max(0,g.target-dec);
const dep=A.filter(x=>x.type=='ahorro'&&x.amount>0),first=dep.map(x=>x.date).sort()[0],w=first?Math.max(1,Math.round((D(today())-D(first))/6048e5)):1,avg=dep.reduce((s,x)=>s+side(x),0)/w;
return{A,B,tot:tt,avg,dep,side,tgt,dec,pct:g.target?(tgt>0?Math.min(100,Math.max(0,tt)/tgt*100):100):0,eta:tgt&&avg>0&&tt<tgt?Math.ceil((tgt-tt)/avg):null}}
function ahorros(){const tc=TCUR(),all=S.goals.reduce((s,g)=>s+conv(gst(g).tot,g.currency_id,tc),0);
return`<div class="row"><h1>${t('Ahorros')}</h1><button class="p" style="width:auto;padding:9px 14px" onclick="goalForm()">＋ ${t('Nueva caja')}</button></div>
${S.goals.length?`<div class="card hero"><div class="lbl">${t('Total en cajas de ahorro')}</div><div class="big">${money(all,tc)}</div></div>`:''}
<div class="gcards">${S.goals.map((g,i)=>{const s=gst(g),pc=g.currency_id,many=curSum(s.B).length>1;return`<div class="card kpi" style="--k:${PAL[i%PAL.length]};cursor:pointer" onclick="S.goal=${g.id};render()"><div class="row"><b>🐷 ${esc(g.name)}</b><b class="sv">${money(s.tot,pc)}</b></div>
${many?`<div class="mut">${breakdown(s.B)}</div>`:''}${g.target?`<div class="bar"><i style="width:${s.pct}%;background:${PAL[i%PAL.length]}"></i></div><div class="mut">${t('{0}% de {1}',Math.round(s.pct),money(s.tgt,pc))}${s.dec?' '+t('(meta original {0})',money(g.target,pc)):''}</div>`:`<div class="mut">${t('Sin meta')}</div>`}</div>`}).join('')}</div>
${S.goals.length?'':`<div class="card">${empty('🐷',t('Todavía no tenés cajas de ahorro. Creá una para separar plata para un objetivo (viaje, auto, emergencias…).'))}</div>`}`}
function goalForm(g){const pc=g?g.currency_id:BASE().id,on=g?gcs(g):[pc];
const f=sheet(`<h2>${g?t('Editar caja'):t('Nueva caja de ahorro')}</h2><label>${t('Nombre')}</label><input name="name" required maxlength="60" value="${esc(g?g.name:'')}" placeholder="${t('Ej: Vacaciones')}">
<label>${t('Moneda principal')}</label><select name="currency_id">${S.currencies.map(c=>`<option value="${c.id}" ${c.id==pc?'selected':''}>${c.code} · ${esc(c.name)}</option>`).join('')}</select>
<label>${t('Meta (opcional, en la moneda principal)')}</label>${mi('target',g&&g.target||'',{sym:CUR(pc).symbol+(CUR(pc).symbol.length>1?' ':''),ph:'0 = '+t('sin meta')})}
${S.currencies.length>1?`<label>${t('Monedas que puede guardar esta caja')}</label>${S.currencies.map(c=>`<label class="ck" style="margin:6px 0"><input type="checkbox" name="c_${c.id}" ${on.includes(c.id)?'checked':''}> ${c.code} · ${esc(c.name)}</label>`).join('')}
<p class="mut">${t('Así podés ahorrar en varias monedas dentro de la misma caja y ver el total junto. La principal siempre queda habilitada.')}</p>`:''}`,
async b=>{const cs=Object.keys(b).filter(k=>k.startsWith('c_')).map(k=>+k.slice(2));await api(g?'goals/'+g.id:'goals',g?'PUT':'POST',{name:b.name,target:+b.target||0,currency_id:+b.currency_id,currencies:cs});load()})}
function meta(){const g=S.goals.find(g=>g.id==S.goal);if(!g){S.goal=null;return ahorros()}const s=gst(g),pc=g.currency_id,last=s.dep[0],cs=gcs(g),mo=v=>money(v,pc);
return`<button class="l lk" onclick="S.goal=null;render()">‹ ${t('Ahorros')}</button><h1>🐷 ${esc(g.name)}</h1><div class="cols"><div>
<div class="card hero"><div class="lbl">${tip(t('Total ahorrado'),t('Plata que hay hoy en esta caja.')+(cs.length>1?' '+t('Convertido a {0} con tus cotizaciones.',CUR(pc).code):''))}</div><div class="big">${mo(s.tot)}</div>
${cs.length>1?`<div class="lbl">${cs.map(c=>money(s.B[c]||0,c)).join(' · ')}</div>`:''}
${g.target?`<div class="bar" style="background:#fff3"><i style="width:${s.pct}%;background:#fff"></i></div><div class="lbl">${t('{0}% de {1}',Math.round(s.pct),mo(s.tgt))}${s.dec?' '+t('(original {0}, ya pagaste {1} en cuotas)',mo(g.target),mo(s.dec)):''} · ${t('faltan {0}',mo(Math.max(0,s.tgt-s.tot)))}</div>`:''}</div>
<div class="grid" style="margin-bottom:10px"><button class="p" onclick="openForm('ahorro',${g.id})">＋ ${t('Aportar')}</button><button class="p ghost" onclick="openForm('retiro',${g.id})">↩ ${t('Retirar')}</button></div>
${cs.length>1?`<button class="p ghost" style="margin-bottom:10px" onclick="openForm('cambio',${g.id})">💱 ${t('Cambiar moneda dentro de la caja')}</button>`:''}
<div class="kpis"><div class="card kpi" style="--k:var(--sv)"><div class="mut">${tip(t('Promedio semanal'),t('Aportes divididos por las semanas desde el primero.'))}</div><div class="v">${mo(s.avg)}</div></div><div class="card kpi" style="--k:var(--acc)"><div class="mut">${tip(t('Aportes'),t('Cantidad de veces que aportaste.'))}</div><div class="v">${s.dep.length}</div></div>
<div class="card kpi" style="--k:var(--in)"><div class="mut">${tip(t('Último aporte'),t('Monto de tu aporte más reciente.'))}</div><div class="v">${last?money(last.amount2??last.amount,last.goal_cur||pc):'—'}</div></div><div class="card kpi" style="--k:var(--tr)"><div class="mut">${tip(t('Meta en'),t('Semanas estimadas para llegar al objetivo al ritmo actual.'))}</div><div class="v">${s.eta?t('{0} semanas',s.eta):'—'}</div></div></div>
<div class="row"><button class="l lk" onclick="goalForm(S.goals.find(g=>g.id==${g.id}))">✎ ${t('Editar caja')}</button><button class="l lk" onclick="corrG(${g.id})">${t('Corregir saldo')}</button><button class="l" onclick="delGoal(${g.id})">${t('Eliminar caja')}</button></div></div>
<div><h2>${t('Movimientos de la caja')}</h2><div class="card">${s.A.map(mvRow).join('')||empty('🐷',t('Sin aportes todavía.'))}</div></div></div>`}
function corrG(id){const g=S.goals.find(g=>g.id==id),cs=gcs(g),B=gbal(g);
const f=sheet(`<h2>${t('Corregir saldo de {0}',esc(g.name))}</h2><p class="mut">${t('Poné cuánto hay realmente en la caja y se registra la diferencia, sin contar como aporte ni retiro.')}</p>
${cs.length>1?`<label>${t('Moneda')}</label><select name="c">${cs.map(c=>`<option value="${c}">${CUR(c).code} (${money(B[c]||0,c)})</option>`).join('')}</select>`:`<input type="hidden" name="c" value="${cs[0]}">`}
<label>${t('Saldo real')}</label>${mi('v',Math.round((B[cs[0]]||0)*100)/100,{sym:CUR(cs[0]).symbol+(CUR(cs[0]).symbol.length>1?' ':''),req:1})}`,async b=>{const c=+b.c,d=Math.round((+b.v-(B[c]||0))*100)/100;if(!d){toast(t('El saldo ya coincide.'));return}
await api('movements','POST',{type:'ajuste',amount:d,date:today(),goal_id:id,goal_cur:c,detail:t('Corrección de saldo')});load()});
f.elements.c.onchange=e=>{const c=+e.target.value,el=f.elements.v;setSym(el,c);setM(el,Math.round((B[c]||0)*100)/100)}}
async function delGoal(id){if(await ask(t('¿Eliminar esta caja?'),t('Eliminar caja'),'🐷'))try{await api('goals/'+id,'DELETE');S.goal=null;load()}catch(e){toast(e.message)}}

// Campos de monto con formato mientras se escribe ($100.000,50 en español, $100,000.50 en inglés).
// El valor visible lleva símbolo y separadores; pmEl() lo convierte a número. data-sym: símbolo, data-dec: decimales, data-neg: permite negativos.
const SEP=()=>L=='en'?[',','.']:['.',','],reEsc=x=>x.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
const fmtN=(n,sym='',dec=2)=>{if(n===''||n==null||isNaN(n))return'';const[th,dc]=SEP(),[i,d]=String(+Math.abs(+n).toFixed(dec)).split('.');return(n<0?'-':'')+sym+i.replace(/\B(?=(\d{3})+(?!\d))/g,th)+(d?dc+d:'')};
const pm=v=>{const[th,dc]=SEP(),x=String(v).replace(new RegExp('[^0-9\\-'+reEsc(dc)+']','g'),'').replace(dc,'.');return x===''||x=='-'?'':+x};
const pmEl=el=>pm((el.dataset.sym&&el.value.includes(el.dataset.sym)?el.value.replace(el.dataset.sym,''):el.value).split(SEP()[0]).join(''));
const mi=(name,val,o={})=>`<input ${name?`name="${name}"`:''} class="money" type="text" inputmode="decimal" autocomplete="off" data-sym="${esc(o.sym??'')}" data-dec="${o.dec??2}"${o.neg?' data-neg="1"':''}${o.req?' required':''}${o.attrs?' '+o.attrs:''} value="${esc(fmtN(val,o.sym??'',o.dec??2))}"${o.ph?` placeholder="${esc(o.ph)}"`:''}>`;
const setM=(el,n)=>{el.value=fmtN(n,el.dataset.sym,+el.dataset.dec);el._raw=el.value};
const setSym=(el,cid)=>{const y=CUR(cid).symbol+(CUR(cid).symbol.length>1?' ':'');if(el&&el.dataset.sym!==y){const n=pmEl(el);el.dataset.sym=y;setM(el,n)}};
function mask(el){const[th,dc]=SEP(),sym=el.dataset.sym||'',dec=+el.dataset.dec,old=el.value,atEnd=(el.selectionStart??old.length)>=old.length;
let v=sym&&old.startsWith(sym)?old.slice(sym.length):old.replace(sym.trim(),'');
// La tecla decimal del celular puede mandar "." en vez de ",": si se acaba de agregar al final, se toma como decimal
if(dec&&el._raw!=null&&old.length==el._raw.length+1&&v.endsWith(th)&&!v.slice(0,-1).includes(dc))v=v.slice(0,-1)+dc;
const neg=el.dataset.neg&&v.trim().startsWith('-'),k=old.slice(0,el.selectionStart??old.length).replace(/[^0-9]/g,'').length;
let[i,...d]=v.replace(new RegExp('[^0-9'+reEsc(dc)+']','g'),'').split(dc);i=i.replace(/^0+(?=\d)/,'');const hasD=dec>0&&d.length>0;
const out=!i&&!hasD?(neg?'-':''):(neg?'-':'')+sym+(i||'0').replace(/\B(?=(\d{3})+(?!\d))/g,th)+(hasD?dc+d.join('').slice(0,dec):'');
el.value=out;el._raw=out;if(document.activeElement!==el)return;let p=out.length;if(!atEnd){p=0;let c=0;while(p<out.length&&c<k){if(/\d/.test(out[p]))c++;p++}}el.setSelectionRange(p,p)}
document.addEventListener('input',e=>{if(e.target.classList&&e.target.classList.contains('money'))mask(e.target)},true);
// Selector propio (categoría, "se paga con"): tocar abre la lista y se elige a mano; mantener apretado y deslizar
// resalta la opción que queda bajo el dedo/mouse y al soltar la elige. El valor va en un <input hidden> que dispara 'change'.
const csel=(name,opts,val,ph,none)=>{const cur=opts.find(o=>String(o.v)==String(val));return`<div class="csw"><input type="hidden" name="${name}" value="${esc(cur?cur.v:'')}"><button type="button" class="csel"><span class="csv">${cur?cur.h:`<span class="mut">${esc(ph)}</span>`}</span><span class="chev">▾</span></button>
<template>${opts.map(o=>`<div class="ci" data-v="${esc(o.v)}">${o.h}</div>`).join('')||`<div class="empty">${esc(none||ph)}</div>`}</template></div>`};
const catOpts=(k,keep)=>{const o=S.categories.filter(c=>c.kind==k).map(c=>({v:c.name,h:`<i class="cdot" style="background:${c.color}"></i><span class="cic">${icoH(c.icon)}</span>${esc(t(c.name))}`}));
if(keep&&!o.some(x=>x.v==keep))o.push({v:keep,h:`<i class="cdot"></i><span class="cic">🏷️</span>${esc(t(keep))}`});return o};
let CP=null;
function cselOpen(btn){cselClose();const w=btn.parentNode,cur=w.querySelector('input').value,p=document.createElement('div');p.className='catpop';p.append(w.querySelector('template').content.cloneNode(true));
p.querySelectorAll('.ci').forEach(x=>x.classList.toggle('on',x.dataset.v==cur));document.body.appendChild(p);
const r=btn.getBoundingClientRect(),h=Math.min(p.scrollHeight,innerHeight*.55),below=innerHeight-r.bottom>h+8||r.top<h+8;
Object.assign(p.style,{left:r.left+'px',width:r.width+'px',maxHeight:h+'px',top:(below?r.bottom+4:r.top-h-4)+'px'});const on=p.querySelector('.on');if(on)on.scrollIntoView({block:'nearest'});
CP={btn,w,p};btn.classList.add('open')}
function cselClose(){if(CP){CP.p.remove();CP.btn.classList.remove('open');CP=null}}
function cselPick(it){const{w,btn}=CP,i=w.querySelector('input');i.value=it.dataset.v;btn.querySelector('.csv').innerHTML=it.innerHTML;cselClose();i.dispatchEvent(new Event('change',{bubbles:true}))}
const ciAt=e=>{const x=document.elementFromPoint(e.clientX,e.clientY);return x&&x.closest('.catpop .ci')};
document.addEventListener('pointerdown',e=>{const b=e.target.closest('.csel');if(b){e.preventDefault();if(CP&&CP.btn==b)return cselClose();cselOpen(b);CP.drag={x:e.clientX,y:e.clientY,moved:false,id:e.pointerId};b.setPointerCapture(e.pointerId);return}
if(CP&&!e.target.closest('.catpop'))cselClose()});
document.addEventListener('pointermove',e=>{const d=CP&&CP.drag;if(!d||e.pointerId!=d.id)return;if(!d.moved&&Math.hypot(e.clientX-d.x,e.clientY-d.y)<6)return;d.moved=true;
const r=CP.p.getBoundingClientRect();if(e.clientY<r.top+28)CP.p.scrollTop-=14;else if(e.clientY>r.bottom-28)CP.p.scrollTop+=14;const it=ciAt(e);CP.p.querySelectorAll('.ci').forEach(x=>x.classList.toggle('hl',x==it))});
document.addEventListener('pointerup',e=>{const d=CP&&CP.drag;if(!d||e.pointerId!=d.id)return;CP.drag=null;if(!d.moved)return;const it=ciAt(e);if(it)cselPick(it);else CP.p.querySelectorAll('.hl').forEach(x=>x.classList.remove('hl'))});
document.addEventListener('click',e=>{const it=e.target.closest('.catpop .ci');if(it&&CP)cselPick(it)});
document.addEventListener('keydown',e=>{const b=e.target.closest&&e.target.closest('.csel');if(b&&(e.key=='Enter'||e.key==' '||e.key=='ArrowDown')){e.preventDefault();cselOpen(b)}else if(CP&&e.key=='Escape')cselClose()});
addEventListener('scroll',e=>{if(CP&&!CP.drag&&e.target!==CP.p)cselClose()},true);addEventListener('resize',()=>cselClose());
// Formularios
// Confirmación propia de la app (en lugar del confirm() del navegador): devuelve una promesa true/false
function ask(msg,ok=t('Borrar'),ic='🗑️'){return new Promise(res=>{const ov=document.createElement('div');ov.className='ov';
ov.innerHTML=`<form class="ask"><div class="askic">${ic}</div><p>${esc(msg)}</p><button class="p danger">${ok}</button><button type="button" class="l x" style="width:100%">${t('Cancelar')}</button></form>`;
document.body.appendChild(ov);const f=ov.querySelector('form'),done=v=>{ov.remove();res(v)};ov.onclick=e=>{if(e.target==ov||e.target.classList.contains('x'))done(false)};
f.onsubmit=e=>{e.preventDefault();done(true)};f.onkeydown=e=>{if(e.key=='Escape')done(false)};setTimeout(()=>f.querySelector('.p').focus())})}
function sheet(html,onsub,o={}){const ov=document.createElement('div');ov.className='ov';
ov.innerHTML=`<form>${html}<p class="err"></p><button class="p${o.danger?' danger':''}">${o.submit||t('Guardar')}</button><button type="button" class="l x" style="width:100%">${t('Cancelar')}</button></form>`;
document.body.appendChild(ov);const f=ov.querySelector('form');ov.onclick=e=>{if(e.target==ov||e.target.classList.contains('x'))ov.remove()};
f.onsubmit=async e=>{e.preventDefault();const b=Object.fromEntries(new FormData(f));f.querySelectorAll('input.money[name]').forEach(i=>{if(!i.disabled)b[i.name]=pmEl(i)});try{await onsub(b,f);ov.remove()}catch(x){f.querySelector('.err').textContent=x.message}};
setTimeout(()=>{const i=f.querySelector('input:not([type=hidden]):not([type=checkbox])');if(i&&matchMedia('(min-width:1024px)').matches)i.focus()});return f}
let T='egreso',LWV=null;
// Tipo de cambio entre dos monedas: se muestra como "1 [la más fuerte] = X [la más débil]" y calcula lo que entra del otro lado
const hiLo=(a,b)=>CUR(a).rate>=CUR(b).rate?[a,b]:[b,a];
function fxHtml(from,to,a,a2){const[hi,lo]=hiLo(from,to),r=a&&a2?(hi==from?a2/a:a/a2):CUR(hi).rate/CUR(lo).rate;
return`<div class="fx"><label>${t('Tipo de cambio')}</label><div class="fxr"><span>1 ${CUR(hi).code} =</span>${mi('fxr',+r.toFixed(4),{dec:4,req:1})}<span>${CUR(lo).code}</span></div>
<label>${t('Entra del otro lado ({0})',CUR(to).code)}</label>${mi('amount2',a2?Math.abs(a2):'',{sym:CUR(to).symbol+(CUR(to).symbol.length>1?' ':''),req:1,attrs:`data-from="${from}" data-to="${to}"`})}</div>`}
function fxCalc(f,src){const a2=f.elements.amount2;if(!a2)return;const a=Math.abs(+pmEl(f.elements.amount)),[hi]=hiLo(+a2.dataset.from,+a2.dataset.to),fr=f.elements.fxr,isHi=hi==+a2.dataset.from;
if(src=='amount2'){const v=+pmEl(a2);if(a&&v)setM(fr,+(isHi?v/a:a/v).toFixed(4))}else{const r=+pmEl(fr);if(a&&r)setM(a2,Math.round((isHi?a*r:a/r)*100)/100)}}
// mv: movimiento a editar. 'retiro' = ahorro con monto negativo (de la caja a una billetera); 'ajuste' = corrección de saldo; 'cambio' = de una moneda a otra dentro de una caja
function openForm(type,gid,mv){const ret=mv&&mv.type=='ahorro'&&mv.amount<0;T=mv?(ret?'retiro':mv.type):type||'egreso';gid=mv?mv.goal_id:gid;
const vis=AW().concat(mv?[mv.wallet_id,mv.to_wallet_id].map(WAL).filter(w=>w&&w.archived):[]);LWV=LWV&&WAL(LWV)&&!WAL(LWV).archived?LWV:(vis[0]||{}).id;
const WS=(n,l,v)=>`<label>${l}</label><select name="${n}">${vis.map(w=>`<option value="${w.id}" ${v==w.id?'selected':''}>${icoT(w.icon)} ${esc(w.name)}${multi()?' · '+CUR(w.currency_id).code:''}</option>`).join('')}</select>`;
const CJ=(l,o)=>`<label>${l}</label><select name="goal_id" required>${S.goals.map(g=>`<option value="${g.id}" ${g.id==gid?'selected':''}>🐷 ${esc(g.name)}${o?' ('+(breakdown(gbal(g))||money(0,g.currency_id))+')':''}</option>`).join('')||`<option value="">${t('Creá una caja primero')}</option>`}</select>`;
const GC=(n,l,g,v)=>g&&gcs(g).length>1?`<label>${l}</label><select name="${n}">${gcs(g).map(c=>`<option value="${c}" ${c==v?'selected':''}>${CUR(c).code} (${money(gbal(g)[c]||0,c)})</option>`).join('')}</select>`:'';

const d0=mv?mv.date:S.view=='sem'&&!(today()>=S.week&&today()<=addD(S.week,6))?S.week:today(),tabs=T=='cambio'?['cambio']:['ingreso','egreso','ahorro','retiro','transferencia'].concat(T=='ajuste'?['ajuste']:[]),wv=mv&&mv.wallet_id||LWV;
const amt0=mv?(ret?(mv.amount2!=null?-mv.amount2:-mv.amount):mv.amount):'';
const f=sheet(`${mv?`<h2>${t('Editar movimiento')}</h2>`:''}<div class="seg">${tabs.map(k=>`<button type="button" data-t="${k}">${tl(k)}</button>`).join('')}</div>
<label id="al">${t('Monto')}</label>${mi('amount',amt0,{neg:1,req:1})}<label>${t('Fecha')}</label><input name="date" type="date" value="${d0}" required>
<label>${t('Detalle')}</label><input name="detail" maxlength="120" value="${esc(mv?mv.detail:'')}"><div id="x"></div><div id="fxw"></div>`,async b=>{
const o={type:T,date:b.date,detail:b.detail,amount:+b.amount,category:b.category||'',importance:b.importance||''},a2=b.amount2!=null?+b.amount2:null;
if(T=='egreso'){const s=b.src;if(s[0]=='g'){o.goal_id=+s.slice(1);o.goal_cur=+b.goal_cur||null;o.dec_target=mv&&mv.goal_id==o.goal_id?mv.dec_target:0}else o.wallet_id=+s}
else if(T=='transferencia'){o.wallet_id=+b.wallet_id;o.to_wallet_id=+b.to_wallet_id;o.amount2=a2}
else if(T=='ahorro'){o.wallet_id=+b.wallet_id;o.goal_id=+b.goal_id;o.goal_cur=+b.goal_cur||null;o.amount2=a2}
else if(T=='retiro'){o.type='ahorro';o.wallet_id=+b.wallet_id;o.goal_id=+b.goal_id;o.goal_cur=+b.goal_cur||null;const x=-Math.abs(o.amount);if(a2!=null){o.amount=-Math.abs(a2);o.amount2=x}else o.amount=x}
else if(T=='cambio'){o.goal_id=+b.goal_id;o.goal_cur=+b.goal_cur;o.goal_cur2=+b.goal_cur2;o.amount2=a2}
else if(T=='ajuste'&&b.goal_id){o.goal_id=+b.goal_id;o.goal_cur=+b.goal_cur||G().currency_id}
else o.wallet_id=+b.wallet_id;
if(o.wallet_id)LWV=o.wallet_id;await api(mv?'movements/'+mv.id:'movements',mv?'PUT':'POST',o);load()});
const x=f.querySelector('#x'),E=f.elements,G=()=>S.goals.find(g=>g.id==(E.goal_id?+E.goal_id.value:gid));
// Monedas de los dos lados según el tipo; si difieren se pide el tipo de cambio (y se avisa si es un aporte o retiro entre monedas)
const sides=()=>{const g=G(),gc=()=>E.goal_cur?+E.goal_cur.value:g&&g.currency_id;
if(T=='transferencia')return[wcur(E.wallet_id.value),wcur(E.to_wallet_id.value)];
if(T=='ahorro')return g?[wcur(E.wallet_id.value),gc()]:null;if(T=='retiro')return g?[gc(),wcur(E.wallet_id.value)]:null;
if(T=='cambio')return E.goal_cur&&E.goal_cur2?[+E.goal_cur.value,+E.goal_cur2.value]:null;if(T=='egreso'&&E.src.value[0]=='g')return null;return null};
const upFx=()=>{const s=sides(),w=f.querySelector('#fxw'),al=f.querySelector('#al');let h='';
const eg=T=='egreso'&&E.src&&E.src.value[0]=='g'?S.goals.find(g=>g.id==+E.src.value.slice(1)):null,ca=s?s[0]:T=='ajuste'&&E.goal_id?(E.goal_cur?+E.goal_cur.value:G().currency_id):eg?(E.goal_cur?+E.goal_cur.value:eg.currency_id):T=='egreso'&&E.src?wcur(E.src.value):E.wallet_id?wcur(E.wallet_id.value):BASE().id;
al.textContent=t('Monto')+(T=='retiro'?' ('+t('sale de la caja')+')':'')+' · '+CUR(ca).code;setSym(E.amount,ca);
if(s&&s[0]!=s[1]){const g=G();if(g&&(T=='ahorro'||T=='retiro'))h+=`<div class="warn">⚠️ ${T=='ahorro'?t('Estás cargando la caja {0} en {1} con una billetera en {2}.',esc(g.name),CUR(s[1]).code,CUR(s[0]).code):t('Estás sacando {0} de la caja {1} hacia una billetera en {2}.',CUR(s[0]).code,esc(g.name),CUR(s[1]).code)} ${t('Lo ideal es primero pasar la plata a una billetera en la misma moneda (con un Pase) y desde ahí aportar o retirar. Si seguís igual, indicá a qué tipo de cambio hiciste la conversión.')}</div>`;
const keep=mv&&mv.amount2!=null?Math.abs(ret?mv.amount:mv.amount2):null;h+=fxHtml(s[0],s[1],+pmEl(E.amount),keep)}
w.innerHTML=h;if(h&&!E.amount2.value)fxCalc(f,'fxr')};
const set=()=>{f.querySelectorAll('[data-t]').forEach(b=>b.classList.toggle('on',b.dataset.t==T));const g=S.goals.find(g=>g.id==gid)||S.goals[0];
x.innerHTML=T=='transferencia'?WS('wallet_id',t('Desde'),wv)+WS('to_wallet_id',t('Hacia'),mv&&mv.to_wallet_id||(vis.find(w=>w.id!=wv)||{}).id)
:T=='ahorro'?WS('wallet_id',t('Desde la billetera'),wv)+CJ(t('Hacia la caja de ahorro'))+GC('goal_cur',t('Moneda en la caja'),g,mv?mv.goal_cur:(gcs(g||{}).includes(wcur(wv))?wcur(wv):g&&g.currency_id))
:T=='retiro'?CJ(t('Desde la caja de ahorro'),1)+GC('goal_cur',t('Moneda que sacás de la caja'),g,mv?mv.goal_cur:g&&g.currency_id)+WS('wallet_id',t('Hacia la billetera'),wv)
:T=='cambio'?CJ(t('Caja'))+GC('goal_cur',t('De'),g,mv?mv.goal_cur:g&&g.currency_id)+GC('goal_cur2',t('A'),g,mv?mv.goal_cur2:gcs(g||{}).find(c=>c!=g.currency_id))
:T=='egreso'?`<label>${t('Se paga con')}</label>${csel('src',vis.map(w=>({v:w.id,h:`<i class="cdot" style="background:${w.color}"></i><span class="cic">${icoH(w.icon)}</span>${esc(w.name)}${multi()?` <span class="mut">${CUR(w.currency_id).code}</span>`:''}`})).concat(S.goals.map(g=>({v:'g'+g.id,h:`<i class="cdot" style="background:var(--sv)"></i><span class="cic">🐷</span>${esc(g.name)}`}))),mv&&mv.goal_id?'g'+mv.goal_id:wv,t('Elegí con qué pagás'))}<div id="egc"></div>
<label>${t('Categoría')}</label>${csel('category',catOpts('egreso',mv&&mv.type=='egreso'&&mv.category),mv?mv.category:'',t('Elegí una categoría'),t('No tenés categorías de gasto. Creálas en Menú → Categorías.'))}<label>${t('Prioridad')}</label>${csel('importance',(S.priorities||[]).map(p=>({v:p.name,h:`<i class="cdot" style="background:${p.color}"></i><span class="cic">${icoH(p.icon)}</span>${esc(t(p.name))}`})).concat(mv&&mv.importance&&!PRX(mv.importance)?[{v:mv.importance,h:esc(t(mv.importance))}]:[]),mv?mv.importance:'',t('Elegí una prioridad'),t('No tenés prioridades. Creálas en Menú → Prioridades.'))}`
:T=='ajuste'&&gid?CJ(t('Caja'))+GC('goal_cur',t('Moneda en la caja'),g,mv?mv.goal_cur:g&&g.currency_id)+`<p class="mut">${t('Corrección de saldo de la caja: suma (o resta, con monto negativo) sin contar como aporte ni retiro.')}</p>`
:T=='ajuste'?WS('wallet_id',t('Billetera'),wv)+`<p class="mut">${t('Corrección de saldo: suma (o resta, con monto negativo) a la billetera sin contar como ingreso ni gasto.')}</p>`
:WS('wallet_id',t('Billetera'),wv)+`<label>${t('Categoría')}</label>${csel('category',catOpts('ingreso',mv&&mv.type=='ingreso'&&mv.category),mv?mv.category:'',t('Elegí una categoría'),t('No tenés categorías de ingreso. Creálas en Menú → Categorías.'))}`;egc();upFx()};
// Gasto pagado con una caja de varias monedas: elegir de qué moneda sale
const egc=()=>{const e=f.querySelector('#egc');if(!e)return;const s=E.src.value,g=s[0]=='g'&&S.goals.find(g=>g.id==+s.slice(1));e.innerHTML=g?GC('goal_cur',t('Moneda de la caja'),g,mv&&mv.goal_id==g.id?mv.goal_cur:g.currency_id):''};
set();f.addEventListener('click',e=>{if(e.target.dataset.t){T=e.target.dataset.t;set()}});
f.addEventListener('change',e=>{const n=e.target.name;if(n=='goal_id'){gid=+e.target.value;set()}else if(n=='src'){egc();upFx()}else if(['wallet_id','to_wallet_id','goal_cur','goal_cur2'].includes(n))upFx()});
f.addEventListener('input',e=>{const n=e.target.name;if(n=='amount'||n=='fxr')fxCalc(f,'fxr');else if(n=='amount2')fxCalc(f,'amount2')})}

// Exportar a Excel
const flt=f=>S.movs.filter(x=>(!f.from||x.date>=f.from)&&(!f.to||x.date<=f.to)&&(!f.type||x.type==f.type)&&(!f.wallet||x.wallet_id==f.wallet||x.to_wallet_id==f.wallet)&&(!f.importance||x.importance==f.importance)&&(!f.category||x.category==f.category)&&(!f.goal||x.goal_id==f.goal));
async function saveFile(name,buf){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1e4)}
function openExport(){const cats=[...new Set(S.movs.map(x=>x.category).filter(Boolean))].sort(),
sel=(n,l,o)=>`<label>${l}</label><select name="${n}"><option value="">${t('Todos')}</option>${o.map(([v,x])=>`<option value="${esc(v)}">${esc(x)}</option>`).join('')}</select>`;
const f=sheet(`<h2>${t('Exportar a Excel')}</h2><div class="grid"><div><label>${t('Desde')}</label><input type="date" name="from" value="${S.from}"></div><div><label>${t('Hasta')}</label><input type="date" name="to" value="${S.to}"></div></div>
${sel('type',t('Tipo'),['ingreso','egreso','ahorro','transferencia','ajuste','cambio'].map(k=>[k,tl(k)]))}${sel('wallet',t('Billetera'),S.wallets.map(w=>[w.id,w.name]))}${sel('importance',t('Prioridad'),(S.priorities||[]).map(p=>[p.name,t(p.name)]))}
${sel('category',t('Categoría'),cats.map(x=>[x,t(x)]))}${sel('goal',t('Caja de ahorro'),S.goals.map(g=>[g.id,g.name]))}<p class="mut" id="cnt"></p>`,
async b=>{const r=flt(b);if(!r.length)throw new Error(t('No hay movimientos con esos filtros'));await doExport(r,b)},{submit:'⬇ '+t('Descargar Excel')});
const upd=()=>{f.querySelector('#cnt').textContent=t('{0} movimientos coinciden con los filtros',flt(Object.fromEntries(new FormData(f))).length)};upd();f.oninput=upd}
async function doExport(rows,f){if(!window.XLSX)throw new Error(t('No se pudo cargar el generador de Excel. Revisá tu conexión.'));
const tc=CUR(TCUR()),sg=x=>x.type=='transferencia'||x.type=='cambio'?0:(x.type=='ingreso'||x.type=='ajuste')?vT(x):-vT(x),gn=id=>{const g=S.goals.find(g=>g.id==id);return g?g.name:''};
const c2=x=>x.type=='transferencia'?wcur(x.to_wallet_id):x.type=='cambio'?x.goal_cur2:x.goal_cur;
const R=[...rows].sort((a,b)=>a.date.localeCompare(b.date)||a.id-b.id).map(x=>({[t('Fecha')]:D(x.date),[t('Tipo')]:tl(x.type=='ahorro'&&x.amount<0?'retiro':x.type),[t('Detalle')]:x.detail,[t('Categoría')]:x.category&&t(x.category),[t('Prioridad')]:x.importance&&t(x.importance),
[t('Billetera')]:WN(x.wallet_id),[t('Hacia')]:x.type=='transferencia'?WN(x.to_wallet_id):'',[t('Caja de ahorro')]:gn(x.goal_id),[t('Monto')]:x.amount,[t('Moneda')]:CUR(mcur(x)).code,
[t('Monto del otro lado')]:x.amount2??'',[t('Moneda del otro lado')]:x.amount2!=null?CUR(c2(x)).code:'',[t('Monto con signo ({0})',tc.code)]:Math.round(sg(x)*100)/100}));
const K=['Ingresos','Correcciones','Gastos','Ahorro','Pagado con cajas'].map(k=>t(k)),mm={};rows.forEach(x=>{const r=mm[x.date.slice(0,7)]??={[t('Mes')]:x.date.slice(0,7),...Object.fromEntries(K.map(k=>[k,0]))},v=vT(x);
if(x.type=='ingreso')r[K[0]]+=v;else if(x.type=='ajuste')r[K[1]]+=v;else if(x.type=='egreso'){r[K[2]]+=v;if(x.goal_id)r[K[4]]+=v}else if(x.type=='ahorro')r[K[3]]+=v});
const M=Object.values(mm).sort((a,b)=>a[t('Mes')].localeCompare(b[t('Mes')])).map(r=>({...r,[t('Resultado')]:r[K[0]]+r[K[1]]-(r[K[2]]-r[K[4]])-r[K[3]],[t('Tasa de ahorro (%)')]:r[K[0]]?Math.round(r[K[3]]/r[K[0]]*1000)/10:0}));
const G=(k,n)=>{const g=grp(rows.filter(x=>x.type=='egreso'),k),s=g.reduce((s,[,v])=>s+v,0);return g.map(([a,v])=>({[n]:t(a),Total:Math.round(v*100)/100,[t('% del gasto')]:s?Math.round(v/s*1000)/10:0}))};
const wb=XLSX.utils.book_new(),add=(n,d,w)=>{const ws=XLSX.utils.json_to_sheet(d.length?d:[{Info:t('Sin datos')}],{dateNF:'dd/mm/yyyy'});ws['!cols']=w.map(c=>({wch:c}));ws['!autofilter']={ref:ws['!ref']};XLSX.utils.book_append_sheet(wb,ws,n)};
add(t('Movimientos'),R,[12,14,28,16,14,14,14,16,12,8,14,10,18]);add(t('Resumen mensual'),M,[10,14,14,14,14,18,14,18]);add(t('Gastos por categoría'),G('category',t('Categoría')),[22,14,12]);add(t('Gastos por prioridad'),G('importance',t('Prioridad')),[22,14,12]);
await saveFile(`fnz_${f.from||'inicio'}_${f.to||today()}.xlsx`,new Uint8Array(XLSX.write(wb,{type:'array',bookType:'xlsx'})))}

// Cuotas: la moneda es la de la billetera (o la principal de la caja) con la que se paga
const FQ={mensual:'Mensual',semanal:'Semanal',dias:'Cada X días'};
const nth=(p,n)=>{const i=n-1;if(p.freq=='semanal')return addD(p.start,7*i);if(p.freq=='dias')return addD(p.start,p.every*i);
const d=D(p.start),y=d.getFullYear(),m=d.getMonth()+i,dim=new Date(y,m+1,0).getDate();return ds(new Date(y,m,Math.min(d.getDate(),dim)))};
const pst=p=>{const done=p.skip+S.movs.filter(x=>x.plan_id==p.id&&x.type=='egreso').length,rem=Math.max(0,p.total-done);return{done,rem,next:rem?nth(p,done+1):null,end:nth(p,p.total)}};
const pcur=p=>p.goal_id?(S.goals.find(g=>g.id==p.goal_id)||{}).currency_id:wcur(p.wallet_id);
async function genCuotas(){let n=0;const x=today();for(const p of S.plans||[]){const have=new Set(S.movs.filter(m=>m.plan_id==p.id&&m.type=='egreso').map(m=>m.cuota_n));
for(let i=p.skip+1;i<=p.total;i++){const d=nth(p,i);if(d>x)break;if(have.has(i))continue;
try{await api('movements','POST',{type:'egreso',amount:p.amount,date:d,wallet_id:p.goal_id?null:p.wallet_id,goal_id:p.goal_id||null,dec_target:p.dec_target||0,category:'Cuotas',importance:((S.priorities||[])[0]||{}).name||'',detail:`${p.name} (${i}/${p.total})`,plan_id:p.id,cuota_n:i});
n++}catch(e){}}}return n}
function cuotas(){const t30=addD(today(),30),tc=TCUR();let deuda=0,prox=0;
const cards=(S.plans||[]).map((p,i)=>{const s=pst(p),g=S.goals.find(g=>g.id==p.goal_id),c=pcur(p),mo=v=>money(v,c);deuda+=conv(p.amount*s.rem,c,tc);for(let j=s.done+1;j<=p.total&&nth(p,j)<=t30;j++)prox+=conv(p.amount,c,tc);
return`<div class="card kpi" style="--k:${PAL[i%PAL.length]}"><div class="row"><b>📆 ${esc(p.name)}</b><b class="out">${mo(p.amount)}</b></div><div class="bar"><i style="width:${s.done/p.total*100}%;background:${PAL[i%PAL.length]}"></i></div>
<div class="mut">${t('Cuota {0} de {1}',Math.min(s.done+1,p.total),p.total)} · ${t(FQ[p.freq])}${p.freq=='dias'?' ('+p.every+')':''} · ${t('pagado {0}',mo(p.amount*s.done))} · ${t('falta {0}',mo(p.amount*s.rem))}</div>
<div class="mut">${s.next?t('Próxima: {0}',fdd(s.next)):t('Plan completo')} · ${t('termina {0}',fdd(s.end))} · ${g?t('se paga con {0}','🐷 '+esc(g.name))+(p.dec_target?' '+t('(también descuenta de la meta)'):''):t('se paga con {0}',wIc(p.wallet_id)+' '+esc(WN(p.wallet_id)))}</div><button class="l" onclick="delPlan(${p.id})">${t('Cancelar plan')}</button></div>`}).join('');
return`<div class="row"><h1>${t('Cuotas')}</h1><button class="p" style="width:auto;padding:9px 14px" onclick="openPlan()">＋ ${t('Nuevo plan')}</button></div>
<div class="kpis"><div class="card kpi" style="--k:var(--out)"><div class="mut">${tip(t('Próximos 30 días'),t('Total de cuotas que vencen en los próximos 30 días.'))}</div><div class="v out">${money(prox,tc)}</div></div>
<div class="card kpi" style="--k:var(--acc)"><div class="mut">${tip(t('Deuda restante'),t('Suma de todas las cuotas que todavía faltan pagar.'))}</div><div class="v">${money(deuda,tc)}</div></div></div>
<div class="gcards">${cards}</div>${cards?'':`<div class="card">${empty('📆',t('Todavía no cargaste cuotas. Creá un plan y la app descuenta cada cuota sola cuando vence.'))}</div>`}`}
async function delPlan(id){if(await ask(t('¿Cancelar este plan? Las cuotas ya descontadas se mantienen.'),t('Cancelar plan'),'📆')){await api('plans/'+id,'DELETE');load()}}
function openPlan(){const f=sheet(`<h2>${t('Nuevo plan de cuotas')}</h2><label>${t('Nombre')}</label><input name="name" required maxlength="60" placeholder="${t('Ej: Celular')}">
<div class="grid"><div><label>${t('Monto por cuota')}</label>${mi('amount','',{req:1,sym:CUR(wcur((AW()[0]||{}).id)).symbol})}</div><div><label>${t('Cantidad de cuotas')}</label><input name="total" type="number" min="1" max="600" required></div></div>
<div class="grid"><div><label>${t('Fecha de la 1ª cuota')}</label><input name="start" type="date" value="${today()}" required></div><div><label>${t('Ya pagadas')}</label><input name="skip" type="number" min="0" value="0"></div></div>
<label>${t('Frecuencia')}</label><select name="freq"><option value="mensual">${t('Mensual (mismo día de cada mes)')}</option><option value="semanal">${t('Semanal')}</option><option value="dias">${t('Cada X días')}</option></select>
<div id="ev" hidden><label>${t('Cada cuántos días')}</label><input name="every" type="number" min="1" value="15"></div>
<div id="wb"><label>${t('Se descuenta de la billetera')}</label><select name="wallet_id">${AW().map(w=>`<option value="${w.id}">${icoT(w.icon)} ${esc(w.name)}${multi()?' · '+CUR(w.currency_id).code:''}</option>`).join('')}</select></div>
<label>${t('Pagar con una caja de ahorro (opcional)')}</label><select name="goal_id"><option value="">${t('No, pagar con una billetera')}</option>${S.goals.map(g=>`<option value="${g.id}">🐷 ${esc(g.name)}</option>`).join('')}</select>
<div id="dt" hidden><label class="ck"><input type="checkbox" name="dec_target"> ${t('Descontar también cada cuota de la meta de la caja')}</label></div>`,
async b=>{const o={name:b.name,amount:+b.amount,total:+b.total,skip:+b.skip||0,start:b.start,freq:b.freq,every:+b.every||0,goal_id:+b.goal_id||null};o.dec_target=o.goal_id&&b.dec_target?1:0;if(!o.goal_id)o.wallet_id=+b.wallet_id;await api('plans','POST',o);load()},{submit:t('Crear plan')});
f.onchange=()=>{const gs=!!f.elements.goal_id.value,gg=gs&&S.goals.find(g=>g.id==+f.elements.goal_id.value);setSym(f.elements.amount,gg?gg.currency_id:wcur(f.elements.wallet_id.value));f.querySelector('#ev').hidden=f.elements.freq.value!='dias';f.querySelector('#wb').hidden=gs;f.querySelector('#dt').hidden=!gs}}

// Billeteras
function billeteras(){const x=today(),act=AW(),arc=S.wallets.filter(w=>w.archived);
const row=w=>`<div class="card kpi" style="--k:${w.color}"><div class="row"><div class="wal"><div class="ic" style="--wc:${w.color}">${icoH(w.icon)}</div><div><b>${esc(w.name)}</b><div class="mut">${CUR(w.currency_id).code} · ${esc(CUR(w.currency_id).name)}</div></div></div><b>${money(bal(w.id,x),w.currency_id)}</b></div>
<div class="row" style="margin-top:6px"><button class="l lk" onclick="walletForm(${w.id})">✎ ${t('Editar')}</button>${w.archived?`<button class="l lk" onclick="archW(${w.id},0)">${t('Desarchivar')}</button>`:`<button class="l" onclick="archW(${w.id},1)">${t('Archivar')}</button>`}<button class="l" onclick="delW(${w.id})">${t('Borrar')}</button></div></div>`;
return`<div class="row"><h1>👛 ${t('Billeteras')}</h1><button class="p" style="width:auto;padding:9px 14px" onclick="walletForm()">＋ ${t('Nueva billetera')}</button></div>
<p class="mut">${t('Creá una billetera por cada lugar donde tenés plata (efectivo, banco, Mercado Pago, tarjeta prepaga…). Cada una trabaja en una moneda.')}</p>
<div class="gcards">${act.map(row).join('')}</div>${arc.length?`<details class="card"><summary><b>${t('Archivadas')}</b> <span class="tag">${arc.length}</span></summary><p class="mut">${t('No aparecen al cargar movimientos, pero sus movimientos y su saldo se siguen contando.')}</p>${arc.map(row).join('')}</details>`:''}`}
function walletForm(id){const w=WAL(id),used=w&&S.movs.some(x=>x.wallet_id==id||x.to_wallet_id==id);
sheet(`<h2>${w?t('Editar billetera'):t('Nueva billetera')}</h2><label>${t('Nombre')}</label><input name="name" required maxlength="40" value="${esc(w?w.name:'')}" placeholder="${t('Ej: Mercado Pago')}">
<label>${t('Moneda')}</label><select name="currency_id" ${used?'disabled':''}>${S.currencies.map(c=>`<option value="${c.id}" ${(w?w.currency_id:BASE().id)==c.id?'selected':''}>${c.code} · ${esc(c.name)}</option>`).join('')}</select>
${used?`<p class="mut">${t('Ya tiene movimientos: la moneda no se puede cambiar.')}</p>`:`<p class="mut">${t('¿Falta la moneda? Creala primero en Monedas.')}</p>`}
<label>${t('Ícono')}</label>${iconPick(w?w.icon:'👛')}<label>${t('Color')}</label>${colorPick(w?w.color:PAL[S.wallets.length%PAL.length])}`,
async b=>{const o={name:b.name,icon:b.icon,color:b.color,currency_id:used?w.currency_id:+b.currency_id};await api(w?'wallets/'+id:'wallets',w?'PUT':'POST',o);load()})}
async function archW(id,a){try{await api('wallets/'+id,'PUT',{archived:a});load()}catch(e){toast(e.message)}}
async function delW(id){if(await ask(t('¿Borrar esta billetera?')))try{await api('wallets/'+id,'DELETE');load()}catch(e){toast(e.message)}}

// Monedas
function monedas(){const b=BASE();
return`<div class="row"><h1>💱 ${t('Monedas')}</h1><button class="p" style="width:auto;padding:9px 14px" onclick="curForm()">＋ ${t('Nueva moneda')}</button></div>
<p class="mut">${t('Cada moneda tiene una cotización contra el {0}. Se usa para convertir totales y como valor sugerido cuando pasás plata entre monedas (siempre podés cambiarlo en ese momento).',esc(b.name))}</p>
<div class="gcards">${S.currencies.map(c=>{const n=S.wallets.filter(w=>w.currency_id==c.id).length;return`<div class="card kpi" style="--k:${c.base?'var(--acc)':'var(--tr)'}"><div class="row"><b>${esc(c.symbol)} ${c.code}</b>${c.base?`<span class="tag">${t('Moneda base')}</span>`:`<b>1 ${c.code} = ${money(c.rate,b.id)}</b>`}</div>
<div class="mut">${esc(c.name)} · ${n==1?t('1 billetera'):t('{0} billeteras',n)}</div><div class="row" style="margin-top:6px"><button class="l lk" onclick="curForm(${c.id})">✎ ${c.base?t('Editar'):t('Editar / actualizar cotización')}</button>${c.base?'':`<button class="l" onclick="delCur(${c.id})">${t('Borrar')}</button>`}</div></div>`}).join('')}</div>`}
function curForm(id){const c=S.currencies.find(c=>c.id==id),b=BASE();
sheet(`<h2>${c?t('Editar moneda'):t('Nueva moneda')}</h2>${c&&c.base?`<p class="mut">${t('Es la moneda base: todas las cotizaciones se miden contra ella.')}</p>`:`<div class="grid"><div><label>${t('Código')}</label><input name="code" required maxlength="6" value="${esc(c?c.code:'')}" placeholder="USD" style="text-transform:uppercase"></div>
<div><label>${t('Símbolo')}</label><input name="symbol" required maxlength="5" value="${esc(c?c.symbol:'')}" placeholder="US$"></div></div>`}
<label>${t('Nombre')}</label><input name="name" required maxlength="30" value="${esc(c?c.name:'')}" placeholder="${t('Ej: Dólar')}">${c&&c.base?`<label>${t('Símbolo')}</label><input name="symbol" required maxlength="5" value="${esc(c.symbol)}">`:
`<label>${t('Cotización: 1 unidad equivale a… ({0})',b.code)}</label>${mi('rate',c?c.rate:'',{sym:b.symbol,dec:4,req:1,ph:b.symbol+'1.500'})}`}`,
async x=>{await api(c?'currencies/'+id:'currencies',c?'PUT':'POST',{...x,rate:+x.rate||1});load()})}
async function delCur(id){if(await ask(t('¿Borrar esta moneda?')))try{await api('currencies/'+id,'DELETE');load()}catch(e){toast(e.message)}}

// Categorías
function categorias(){const blk=(k,n)=>`<div class="row"><h2>${t(n)}</h2><button class="l lk" onclick="catForm(null,'${k}')">＋ ${t('Agregar')}</button></div><div class="card">${S.categories.filter(c=>c.kind==k).map(c=>{const used=S.movs.filter(x=>x.type==k&&x.category==c.name).length;return`<div class="mv" style="--c:${c.color}"><div class="ic">${icoH(c.icon)}</div><div class="tx"><b>${esc(t(c.name))}</b><div class="mut">${used==1?t('1 movimiento'):t('{0} movimientos',used)}</div></div>
<div class="am"><button class="l lk" onclick="catForm(${c.id})">${t('editar')}</button><button class="l" onclick="delCat(${c.id})">${t('borrar')}</button></div></div>`}).join('')||empty('🏷️',t('Sin categorías.'))}</div>`;
return`<div class="row"><h1>🏷️ ${t('Categorías')}</h1><button class="p" style="width:auto;padding:9px 14px" onclick="catForm()">＋ ${t('Nueva categoría')}</button></div>
<p class="mut">${t('Ordenan tus gastos e ingresos en los gráficos. Al cargar un gasto o un ingreso elegís entre estas.')}</p><div class="cols"><div>${blk('egreso','Gastos')}</div><div>${blk('ingreso','Ingresos')}</div></div>`}
function catForm(id,kind){const c=S.categories.find(c=>c.id==id);
sheet(`<h2>${c?t('Editar categoría'):t('Nueva categoría')}</h2>${c?'':`<label>${t('Tipo')}</label><select name="kind"><option value="egreso">${t('Gasto')}</option><option value="ingreso" ${kind=='ingreso'?'selected':''}>${t('Ingreso')}</option></select>`}
<label>${t('Nombre')}</label><input name="name" required maxlength="40" value="${esc(c?c.name:'')}">${c?`<p class="mut">${t('Si la renombrás, se actualizan también los movimientos que la usan.')}</p>`:''}
<label>${t('Ícono')}</label>${iconPick(c?c.icon:'🏷️')}<label>${t('Color')}</label>${colorPick(c?c.color:PAL[S.categories.length%PAL.length])}`,
async b=>{await api(c?'categories/'+id:'categories',c?'PUT':'POST',b);load()})}
async function delCat(id){if(await ask(t('¿Borrar esta categoría? Los movimientos conservan el nombre.'))){await api('categories/'+id,'DELETE');load()}}

// Prioridades (antes "importancia"): qué tan necesario es cada gasto
function prioridades(){const P=S.priorities||[];
return`<div class="row"><h1>🚦 ${t('Prioridades')}</h1><button class="p" style="width:auto;padding:9px 14px" onclick="prioForm()">＋ ${t('Nueva prioridad')}</button></div>
<p class="mut">${t('Al cargar un gasto le ponés una prioridad: así ves cuánto se va en lo necesario y cuánto en gustos.')}</p>
<div class="card narrow">${P.map(p=>{const used=S.movs.filter(x=>x.importance==p.name).length;return`<div class="mv" style="--c:${p.color}"><div class="ic">${icoH(p.icon)}</div><div class="tx"><b>${esc(t(p.name))}</b><div class="mut">${used==1?t('1 movimiento'):t('{0} movimientos',used)}</div></div>
<div class="am"><button class="l lk" onclick="prioForm(${p.id})">${t('editar')}</button><button class="l" onclick="delPrio(${p.id})">${t('borrar')}</button></div></div>`}).join('')||empty('🚦',t('Sin prioridades.'))}</div>`}
function prioForm(id){const p=(S.priorities||[]).find(p=>p.id==id);
sheet(`<h2>${p?t('Editar prioridad'):t('Nueva prioridad')}</h2><label>${t('Nombre')}</label><input name="name" required maxlength="30" value="${esc(p?p.name:'')}" placeholder="${t('Ej: Ahorro')}">${p?`<p class="mut">${t('Si la renombrás, se actualizan también los movimientos que la usan.')}</p>`:''}
<label>${t('Ícono')}</label>${iconPick(p?p.icon:'🚦')}<label>${t('Color')}</label>${colorPick(p?p.color:PAL[(S.priorities||[]).length%PAL.length])}`,
async b=>{await api(p?'priorities/'+id:'priorities',p?'PUT':'POST',b);load()})}
async function delPrio(id){if(await ask(t('¿Borrar esta prioridad? Los movimientos conservan el nombre.'))){await api('priorities/'+id,'DELETE');load()}}

// Configuración
function config(){const s=S.settings,th=s.theme||'crema',lg=s.lang||'es',m=MODE();
return`<div class="narrow"><h1>⚙️ ${t('Configuración')}</h1>
<h2>${t('Idioma')}</h2><div class="card"><div class="seg">${[['es','🇦🇷 Español'],['en','🇺🇸 English']].map(([k,n])=>`<button type="button" class="${lg==k?'on':''}" onclick="setS('lang','${k}')">${n}</button>`).join('')}</div></div>
<h2>${t('Tema')}</h2><div class="themes">${THEMES.map(([k,n,c])=>`<button type="button" class="th ${th==k?'on':''}" onclick="setS('theme','${k}')"><div class="sw">${c.map(x=>`<i style="background:${x}"></i>`).join('')}</div><b>${t(n)}</b>${th==k?' ✓':''}</button>`).join('')}</div>
<h2>${t('Cómo ver los totales')}</h2><div class="card" id="cfgtot"><div class="seg">${[['ambos','Ambos'],['separado','Separado por moneda'],['una','Todo en una moneda']].map(([k,n])=>`<button type="button" class="${m==k?'on':''}" onclick="setS('totals','${k}')">${t(n)}</button>`).join('')}</div>
<p class="mut">${m=='ambos'?t('Un total convertido a la moneda elegida y, debajo, el detalle por moneda.'):m=='separado'?t('Un total por cada moneda, sin convertir.'):t('Todo convertido a la moneda elegida con tus cotizaciones.')}</p>
${m!='separado'?`<label>${t('Moneda para los totales')}</label><select onchange="setS('tcur',+this.value)">${S.currencies.map(c=>`<option value="${c.id}" ${c.id==TCUR()?'selected':''}>${c.code} · ${esc(c.name)}</option>`).join('')}</select>`:''}</div>
<h2>${t('Tutorial')}</h2><div class="card" id="cfgtut"><button class="p ghost" onclick="restartTour()">🧭 ${t('Reiniciar tutorial de inicio')}</button>
<p class="mut">${t('Vuelve a preguntarte tus saldos y te muestra la app paso a paso. Cada sección tiene además su botón ? con una visita guiada.')}</p>
<label class="ck" style="margin-top:10px"><input type="checkbox" ${s.pasos=='on'?'checked':''} onchange="setS('pasos',this.checked?'on':'off')"> ${t('Mostrar “Primeros pasos” en el Resumen')}</label></div>
<p class="mut">${t('Se guarda en tu cuenta: vas a ver lo mismo en el celular y en la computadora.')}</p></div>`}

// Cuenta
const WORDS=['naranja','galaxia','pinguino','alfajor','brujula','lechuza','cometa','tornillo','glaciar','mandarina','yacare','tucan','tango','volcan','pomelo'];
function cuenta(){return`<div class="narrow"><h1>👤 ${t('Cuenta')}</h1>
<div class="card"><div class="wal"><div class="ic" style="--wc:var(--acc)">👤</div><div><div class="mut">${t('Usuario')}</div><b style="font-size:18px">${esc(S.username)}</b></div></div></div>
<h2>${t('Cambiar usuario')}</h2><form class="card" onsubmit="acc(event)"><label>${t('Usuario nuevo')}</label><input name="username" required minlength="3" maxlength="30" autocomplete="username" autocapitalize="off">
<label>${t('Contraseña actual')}</label><div class="pw"><input name="password" type="password" required autocomplete="current-password">${EYE()}</div><p class="err"></p><button class="p">${t('Guardar usuario')}</button></form>
<h2>${t('Cambiar contraseña')}</h2><form class="card" onsubmit="acc(event)"><label>${t('Contraseña actual')}</label><div class="pw"><input name="password" type="password" required autocomplete="current-password">${EYE()}</div>
<label>${t('Contraseña nueva')}</label><div class="pw"><input name="new_password" type="password" required minlength="8" autocomplete="new-password">${EYE()}</div><label>${t('Repetí la contraseña nueva')}</label><div class="pw"><input name="rep" type="password" required minlength="8" autocomplete="new-password">${EYE()}</div>
<p class="err"></p><button class="p">${t('Guardar contraseña')}</button></form>
<h2 class="out">${t('Zona de peligro')}</h2><div class="card" style="border-color:color-mix(in srgb,var(--out) 45%,transparent)"><b>🧨 ${t('Formatear cuenta')}</b><p class="mut">${t('Borra los datos que elijas para empezar de cero. No se puede deshacer desde la app.')}</p><button class="p danger" onclick="openReset()">${t('Formatear cuenta…')}</button>
<hr style="border:0;border-top:1px solid var(--line);margin:16px 0"><b>🗑️ ${t('Eliminar cuenta')}</b><p class="mut">${t('Borra tu usuario y todos tus datos para siempre. No se puede recuperar.')}</p><button class="p danger" onclick="openDelAcc()">${t('Eliminar cuenta…')}</button></div>
<button class="p ghost" style="margin-top:14px" onclick="logout()">🚪 ${t('Cerrar sesión')}</button></div>`}
async function acc(e){e.preventDefault();const f=e.target,b=Object.fromEntries(new FormData(f)),m=f.querySelector('.err');
if(b.rep!==undefined&&b.new_password!==b.rep){m.textContent=t('Las contraseñas nuevas no coinciden');return}delete b.rep;
try{const r=await api('account','PUT',b);S.username=r.username;render(1);toast(b.new_password?t('Contraseña actualizada'):t('Usuario actualizado'))}catch(x){m.textContent=x.message}}
const vword=()=>WORDS[Math.floor(Math.random()*WORDS.length)]+'-'+(10+Math.floor(Math.random()*90));
function openDelAcc(){const w=vword();
sheet(`<h2 class="out">⚠️ ${t('Eliminar cuenta')}</h2><p>${t('Se borran tu usuario {0} y todos tus datos: movimientos, billeteras, cajas, cuotas, categorías y configuración.',`<b>${esc(S.username)}</b>`)}</p>
<div class="warn">${t('Esto no se puede deshacer. Si querés empezar de cero pero seguir usando la app, usá “Formatear cuenta”.')}</div>
<label>${t('Para confirmar, escribí esta palabra:')}</label><div class="word">${w}</div><input name="word" autocomplete="off" autocapitalize="off" spellcheck="false" required>
<label>${t('Tu contraseña')}</label><div class="pw"><input name="password" type="password" required autocomplete="current-password">${EYE()}</div>`,
async b=>{if(b.word.trim().toLowerCase()!==w)throw new Error(t('La palabra no coincide'));await api('account/delete','POST',{password:b.password});
menu(0);tourEnd(1);TB=false;Object.assign(S,{movs:[],goals:[],plans:[],view:'res',goal:null,username:'',settings:{}});loginView();toast(t('Tu cuenta fue eliminada'))},{submit:t('Eliminar cuenta para siempre'),danger:1})}
function openReset(){const w=vword();
const f=sheet(`<h2 class="out">⚠️ ${t('Formatear cuenta')}</h2><p>${t('Elegí qué querés borrar:')}</p>
${[['movimientos','Movimientos (ingresos, gastos, pases y correcciones)'],['cajas','Cajas de ahorro (con sus aportes y retiros)'],['cuotas','Planes de cuotas'],['billeteras','Billeteras y monedas (vuelven a Efectivo y Virtual en pesos; borra también movimientos, cajas y cuotas)'],['categorias','Categorías (vuelven a las de fábrica)'],['prioridades','Prioridades (vuelven a Necesario, Útil y Gusto)'],['configuracion','Configuración (idioma, tema y totales)']].map(([k,n])=>`<label class="ck" style="margin:8px 0"><input type="checkbox" name="w_${k}"> ${t(n)}</label>`).join('')}
<div class="warn">${t('Si borrás los movimientos pero no los planes de cuotas, las cuotas ya vencidas se vuelven a cargar solas.')}</div>
<label>${t('Para confirmar, escribí esta palabra:')}</label><div class="word">${w}</div><input name="word" autocomplete="off" autocapitalize="off" spellcheck="false" required>
<label>${t('Tu contraseña')}</label><div class="pw"><input name="password" type="password" required autocomplete="current-password">${EYE()}</div>`,
async b=>{const what=Object.keys(b).filter(k=>k.startsWith('w_')).map(k=>k.slice(2));if(!what.length)throw new Error(t('Elegí qué querés borrar'));
if(b.word.trim().toLowerCase()!==w)throw new Error(t('La palabra no coincide'));await api('reset','POST',{password:b.password,what});S.view='res';S.goal=null;toast(t('Listo, cuenta formateada'));load()},{submit:t('Formatear'),danger:1});
// Billeteras y monedas arrastra movimientos, cajas y cuotas: se tildan y bloquean solas
f.addEventListener('change',e=>{if(e.target.name!='w_billeteras')return;['movimientos','cajas','cuotas'].forEach(k=>{const c=f.elements['w_'+k];c.checked=c.checked||e.target.checked;c.disabled=e.target.checked})})}

initSide();load();
