// Cuentas: frontend sin build. Los textos pasan por t(): el español es la clave y i18n.js tiene el inglés.
const p2=x=>String(x).padStart(2,'0'),ds=d=>`${d.getFullYear()}-${p2(d.getMonth()+1)}-${p2(d.getDate())}`,D=s=>new Date(s+'T12:00:00');
const today=()=>ds(new Date()),addD=(s,n)=>{const d=D(s);d.setDate(d.getDate()+n);return ds(d)},wk=s=>addD(s,-((D(s).getDay()+2)%7)); // semanas desde el viernes
const $=s=>document.querySelector(s),esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const store=(k,v)=>{try{return v===undefined?localStorage.getItem(k):localStorage.setItem(k,v)}catch{return null}};
let L=store('lang')||'es';
const t=(s,...a)=>{let r=(L=='en'&&EN[s])||s;a.forEach((v,i)=>r=r.split('{'+i+'}').join(v));return r};
const LOC=()=>L=='en'?'en-US':'es-AR',money=n=>(n<0?'-':'')+'$'+Math.abs(Math.round(n)).toLocaleString(LOC()),fdate=(s,o)=>D(s).toLocaleDateString(LOC(),o);
const api=async(p,m='GET',b)=>{const r=await fetch('/api/'+p,{method:m,headers:{'Content-Type':'application/json'},body:b?JSON.stringify(b):undefined});const j=await r.json().catch(()=>({}));if(!r.ok)throw Object.assign(new Error(t(j.error||'Error')),{st:r.status});return j};
let S={f:{types:[],min:'',max:'',wallet:'',q:'',all:false},view:'res',movs:[],goals:[],plans:[],settings:{},username:'',from:'',to:'',week:wk(today()),goal:null,reg:false};

// Apariencia e idioma
const THEMES=[['claro','Claro',['#F2F4FA','#5B4FE0','#0E9F6E','#E5484D']],['oscuro','Oscuro',['#111318','#8B83F7','#34D399','#F87171']],['medianoche','Medianoche',['#060A18','#22D3EE','#A78BFA','#FB7185']],['crema','Crema',['#F6EFE2','#B45309','#3F7D20','#B42318']]];
function applyTheme(th){document.documentElement.dataset.theme=th;store('theme',th);const m=$('meta[name=theme-color]');if(m)m.content=(THEMES.find(x=>x[0]==th)||THEMES[0])[2][0]}
function setLang(l){L=l;store('lang',l);document.documentElement.lang=l}
async function setS(k,v){S.settings[k]=v;if(k=='theme')applyTheme(v);if(k=='lang')setLang(v);render(1);try{S.settings=await api('settings','PUT',{[k]:v})}catch(e){toast(e.message)}}
function toast(m){const d=document.createElement('div');d.className='toast';d.textContent=m;document.body.appendChild(d);setTimeout(()=>d.remove(),2600)}

// Tipos de movimiento y billeteras
const TL={ingreso:'Ingreso',egreso:'Gasto',ahorro:'Ahorro',retiro:'Retiro',transferencia:'Pase',ajuste:'Corrección'},tl=k=>t(TL[k]);
const TI={ingreso:'💵',egreso:'🧾',ahorro:'🐷',retiro:'↩️',transferencia:'⇄',ajuste:'✎'},TC={ingreso:'var(--in)',egreso:'var(--out)',ahorro:'var(--sv)',retiro:'var(--sv)',transferencia:'var(--tr)',ajuste:'var(--aj)'};
const WV={efectivo:{n:'Efectivo',ic:'💵',c:'#16A34A'},virtual:{n:'Virtual',ic:'💳',c:'#2563EB'}},WK=Object.keys(WV),WN=w=>WV[w]?t(WV[w].n):'';
const IMP={Esencial:'var(--out)',Necesario:'var(--tr)',Prescindible:'var(--sv)'},PAL=['#5B4FE0','#0E9F6E','#E5484D','#2F7BEA','#D97706','#C026D3','#0891B2','#65A30D','#DB2777','#7C3AED'];
const cn=g=>t('Caja {0}',g.name);
const sum=(a,k)=>a.filter(x=>x.type==k).reduce((s,x)=>s+x.amount,0);
const tip=(l,x)=>`<span data-tip="${esc(x)}" tabindex="0">${l}</span>`;
const bal=(w,upTo)=>S.movs.reduce((s,x)=>{if(x.date>upTo)return s;const a=x.amount;if(x.type=='transferencia')return s+(x.to_wallet==w?a:0)-(x.wallet==w?a:0);
if(x.wallet!=w)return s;return s+(x.type=='ingreso'||x.type=='ajuste'?a:-a)},0);
const grp=(a,k)=>Object.entries(a.reduce((o,x)=>(o[x[k]||t('Sin dato')]=(o[x[k]||t('Sin dato')]||0)+x.amount,o),{})).sort((a,b)=>b[1]-a[1]);
const bars=(a,col=(k,i)=>PAL[i%PAL.length])=>{const m=a[0]?a[0][1]:1;return a.map(([k,v],i)=>`<div class="row"><span>${esc(k)}</span><b>${money(v)}</b></div><div class="bar"><i style="width:${v/m*100}%;background:${col(k,i)}"></i></div>`).join('')||`<p class="mut">${t('Sin datos todavía.')}</p>`};
const empty=(ic,m)=>`<div class="empty"><b>${ic}</b>${m}</div>`;

// Carga, login y estructura
async function load(){try{Object.assign(S,await api('data'));setLang(S.settings.lang||'es');applyTheme(S.settings.theme||'claro');
if(await genCuotas()>0)Object.assign(S,await api('data'));document.body.classList.remove('auth');render()}catch(e){if(e.st==401)loginView();else toast(e.message)}}
function loginView(){document.body.classList.add('auth');['#top','#side','#bnav'].forEach(s=>$(s).innerHTML='');
$('#app').innerHTML=`<div style="text-align:center;margin:40px 0 18px"><div style="font-size:44px">💸</div><h1 style="margin:6px 0 2px">Cuentas</h1><div class="mut">${t('Tus finanzas, claras.')}</div></div>
<form class="card" onsubmit="auth(event)"><label>${t('Usuario')}</label><input name="u" autocomplete="username" required>
<label>${t('Contraseña')}</label><input name="p" type="password" autocomplete="${S.reg?'new-password':'current-password'}" required><p class="err" id="e"></p>
<button class="p">${S.reg?t('Crear cuenta'):t('Entrar')}</button><button type="button" class="l" style="width:100%" onclick="S.reg=!S.reg;loginView()">${S.reg?t('Ya tengo cuenta'):t('Crear una cuenta')}</button></form>
<div class="seg" style="max-width:200px;margin:12px auto">${[['es','Español'],['en','English']].map(([k,n])=>`<button type="button" class="${L==k?'on':''}" onclick="setLang('${k}');loginView()">${n}</button>`).join('')}</div>`}
async function auth(e){e.preventDefault();const f=e.target;try{await api(S.reg?'register':'login','POST',{username:f.u.value,password:f.p.value});load()}catch(x){$('#e').textContent=x.message}}
async function logout(){await api('logout','POST').catch(()=>{});menu(0);Object.assign(S,{movs:[],goals:[],plans:[],view:'res',goal:null});loginView()}
const MAIN=[['res','Resumen','📊'],['sem','Semanas','🗓️'],['aho','Ahorros','🐷'],['cuo','Cuotas','📆']],MENU=[['cfg','Configuración','⚙️'],['cta','Cuenta','👤']];
function go(v){S.view=v;S.goal=null;menu(0);render()}
function menu(o){$('#side').classList.toggle('open',!!o);const s=$('#scrim');if(o&&!s){const d=document.createElement('div');d.id='scrim';d.onclick=()=>menu(0);document.body.appendChild(d)}else if(!o&&s)s.remove()}
function side(){const it=(c)=>([k,n,i])=>`<button class="it ${c}${S.view==k?' on':''}" onclick="go('${k}')"><span>${i}</span>${t(n)}</button>`;
return`<div class="brand">💸 Cuentas</div><div class="who">${esc(S.username)}</div><button class="p add main-only" onclick="openForm()">＋ ${t('Cargar movimiento')}</button>
<div class="sec main-only">${t('Principal')}</div>${MAIN.map(it('main-only')).join('')}<div class="sec">${t('Menú')}</div>${MENU.map(it('')).join('')}
<div style="flex:1"></div><button class="it" onclick="logout()"><span>🚪</span>${t('Cerrar sesión')}</button>`}
function render(keep){const v=S.view;
$('#top').innerHTML=`<button class="burger" onclick="menu(1)" aria-label="${t('Menú')}">☰</button><span class="brand">${t((MAIN.concat(MENU).find(x=>x[0]==v)||MAIN[0])[1])}</span>`;
$('#bnav').innerHTML=MAIN.map(([k,n,i])=>`<button class="${v==k?'on':''}" onclick="go('${k}')"><span>${i}</span>${t(n)}</button>`).join('')+`<button class="add" onclick="openForm()"><span>＋</span>${t('Cargar')}</button>`;
$('#side').innerHTML=side();
$('#app').innerHTML=v=='res'?resumen():v=='sem'?semana():v=='cuo'?cuotas():v=='cfg'?config():v=='cta'?cuenta():S.goal?meta():ahorros();if(!keep)scrollTo(0,0)}

// Resumen
const dd=(a,b)=>Math.round((D(b)-D(a))/864e5)+1,fdd=s=>fdate(s,{day:'numeric',month:'short',year:'numeric'});
const perR=k=>{const x=today(),y=+x.slice(0,4),m=+x.slice(5,7);return k=='m'?[x.slice(0,8)+'01',x]:k=='pm'?[ds(new Date(y,m-2,1)),ds(new Date(y,m-1,0))]:k=='y'?[y+'-01-01',x]:['','']};
function per(k){[S.from,S.to]=perR(k);render(1)}
function walletCard(w,v,extra=''){return`<div class="card"><div class="wal"><div class="ic" style="--wc:${WV[w].c}">${WV[w].ic}</div><div><div class="mut">${WN(w)}</div><b style="font-size:20px">${money(v)}</b>${extra}</div></div><button class="l lk" style="padding:6px 0 0" onclick="corr('${w}')">${t('Corregir saldo')}</button></div>`}
function resumen(){const F=S.from,To=S.to,x=today(),M=S.movs.filter(m=>(!F||m.date>=F)&&(!To||m.date<=To)),ing=sum(M,'ingreso'),egr=sum(M,'egreso'),aho=sum(M,'ahorro');
const wb=Object.fromEntries(WK.map(w=>[w,bal(w,x)])),disp=WK.reduce((s,w)=>s+wb[w],0),cj=S.goals.reduce((s,g)=>s+gst(g).tot,0),st=F||(S.movs.length?S.movs[S.movs.length-1].date:x),en=To&&To<x?To:x,dias=Math.max(1,dd(st,en));
const pe=F&&To?sum(S.movs.filter(m=>m.date>=addD(F,-dd(F,To))&&m.date<=addD(F,-1)),'egreso'):0,E=M.filter(m=>m.type=='egreso');
const dow=['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'],byd=grp(E.map(m=>({...m,d:t(dow[D(m.date).getDay()])})),'d')[0];
const P=[['','Todo'],['m','Este mes'],['pm','Mes pasado'],['y','Este año']],pk=k=>{const[a,b]=perR(k);return a==F&&b==To};
const kpi=(l,h,v,c)=>`<div class="card kpi" style="--k:${c}"><div class="mut">${tip(t(l),t(h))}</div><div class="v" style="color:${c}">${v}</div></div>`;
return`<div class="row"><h1>${t('Resumen')}</h1><button class="l lk" onclick="openExport()">⬇ ${t('Exportar Excel')}</button></div>
<div class="top4" style="margin-bottom:10px"><div class="card hero"><div class="lbl">${tip(t('Disponible'),t('Lo que tenés hoy en tus billeteras, contando todo desde que empezaste. No incluye lo guardado en cajas de ahorro.'))}</div><div class="big">${money(disp)}</div>
<div class="sub"><span>🐷 ${t('En ahorros')} <b>${money(cj)}</b></span><span>Σ ${t('Total')} <b>${money(disp+cj)}</b></span></div></div>${WK.map(w=>walletCard(w,wb[w])).join('')}</div>
<h2>${t('Análisis')}</h2><div class="perbar"><div class="seg">${P.map(([k,n])=>`<button type="button" class="${pk(k)?'on':''}" onclick="per('${k}')">${t(n)}</button>`).join('')}</div>
<div><label>${t('Desde')}</label><input type="date" value="${F}" onchange="S.from=this.value;render(1)"></div><div><label>${t('Hasta')}</label><input type="date" value="${To}" onchange="S.to=this.value;render(1)"></div></div>
<p class="mut">${F||To?t('Del {0} al {1}',F?fdd(F):t('inicio'),To?fdd(To):t('hoy')):t('Todo el historial')}</p>
<div class="kpis">${kpi('Ingresos','Plata que entró en el período.',money(ing),'var(--in)')}${kpi('Gastos','Lo que gastaste en el período, sin contar los ahorros.',money(egr),'var(--out)')}
${kpi('Ahorrado','Lo que aportaste a tus cajas en el período, menos lo que retiraste.',money(aho),'var(--sv)')}${kpi('Tasa de ahorro','Porcentaje de tus ingresos que fue a ahorro.',(ing?Math.round(aho/ing*100):0)+'%','var(--acc)')}
${kpi('Gasto diario prom.','Gastos del período divididos por los días transcurridos.',money(egr/dias),'var(--tr)')}${kpi('vs. período anterior','Cuánto más o menos gastaste que en el período de igual duración inmediatamente anterior. Elegí desde y hasta para verlo.',pe?(egr>pe?'+':'')+Math.round((egr-pe)/pe*100)+'%':'—','var(--aj)')}</div>
${byd?`<p class="mut">${t('Día en que más gastás:')} <b>${byd[0]}</b></p>`:''}
<div class="cols"><div><h2>${t('Gastos por categoría')}</h2><div class="card">${bars(grp(E,'category'))}</div><h2>${t('Gastos por importancia')}</h2><div class="card">${bars(grp(E.map(m=>({...m,importance:m.importance&&t(m.importance)})),'importance'),k=>IMP[Object.keys(IMP).find(i=>t(i)==k)]||'var(--aj)')}</div>
<h2>${t('Gastos por billetera')}</h2><div class="card">${bars(grp(E.map(m=>({...m,w:WN(m.wallet)||t('Caja de ahorro')})),'w'),k=>(WK.map(w=>WV[w]).find(v=>t(v.n)==k)||{c:'var(--sv)'}).c)}</div></div>
<div><h2>${t('Últimos movimientos')}</h2><div class="card">${M.slice(0,8).map(mvRow).join('')||empty('🗒️',t('Todavía no hay movimientos en este período.'))}</div>${M.length>8?`<button class="l lk" onclick="S.f.all=true;go('sem')">${t('Ver todos los movimientos')} →</button>`:''}</div></div>`}
function corr(w){const cur=bal(w,today());sheet(`<h2>${t('Corregir saldo de {0}',WN(w))}</h2><p class="mut">${t('Hoy la app dice {0}. Poné cuánto tenés realmente y se registra la diferencia, sin contar como ingreso ni gasto.',money(cur))}</p>
<label>${t('Saldo real')}</label><input name="v" type="number" step="any" inputmode="decimal" required value="${Math.round(cur)}">`,async b=>{const d=Math.round((+b.v-cur)*100)/100;if(!d){toast(t('El saldo ya coincide.'));return}
await api('movements','POST',{type:'ajuste',amount:d,date:today(),wallet:w,detail:t('Corrección de saldo')});load()})}

// Semanas y lista de movimientos
function semana(){const a=S.week,b=addD(a,6),W=S.movs.filter(x=>x.date>=a&&x.date<=b),ing=sum(W,'ingreso'),egr=sum(W,'egreso'),aho=sum(W,'ahorro'),aj=sum(W,'ajuste'),egW=sum(W.filter(x=>!x.goal_id),'egreso'),f=s=>fdate(s,{day:'numeric',month:'short'});
return`<h1>${t('Semana')}</h1><div class="cols"><div><div class="row card" style="padding:8px"><button class="l" onclick="S.week=addD(S.week,-7);render(1)">‹ ${t('Anterior')}</button><b>${f(a)} – ${f(b)}</b><button class="l" onclick="S.week=addD(S.week,7);render(1)">${t('Siguiente')} ›</button></div>
<div class="card hero"><div class="lbl">${tip(t('Resultado de la semana'),t('Cuánto cambió tu disponible: ingresos y correcciones menos gastos y ahorro de esta semana. No cuenta lo pagado con cajas de ahorro.'))}</div><div class="big">${money(ing+aj-egW-aho)}</div>
<div class="sub"><span>${t('Ingresos')} <b>${money(ing)}</b></span><span>${t('Gastos')} <b>${money(egr)}</b></span><span>${t('Ahorro')} <b>${money(aho)}</b></span>${aj?`<span>${t('Correcciones')} <b>${money(aj)}</b></span>`:''}</div></div>
<div class="grid">${WK.map(w=>{const e=bal(w,b),d=e-bal(w,addD(a,-1));return`<div class="card"><div class="wal"><div class="ic" style="--wc:${WV[w].c}">${WV[w].ic}</div><div><div class="mut">${tip(WN(w),t('Saldo al cierre de la semana. Arrastra lo de semanas anteriores.'))}</div><b>${money(e)}</b><div class="mut">${d>=0?'+':'−'}${money(Math.abs(d))} ${t('esta semana')}</div></div></div></div>`}).join('')}</div>
${filtros()}</div><div><h2 class="main-h">${t('Movimientos')}</h2><div id="lst">${lista()}</div></div></div>`}
async function del(id){if(confirm(t('¿Borrar este movimiento?'))){await api('movements/'+id,'DELETE');load()}}
function edit(id){const x=S.movs.find(x=>x.id==id);if(x)openForm(null,null,x)}
function mvRow(x){const g=S.goals.find(g=>g.id==x.goal_id),ret=x.type=='ahorro'&&x.amount<0,k=ret?'retiro':x.type,inCaja=S.view=='aho'&&S.goal;
const sg=x.type=='transferencia'?'':inCaja?(x.type=='ahorro'&&x.amount>0?'+':'−'):(x.type=='ingreso'||(x.type=='ajuste'&&x.amount>0)||ret)?'+':'−';
const tags=g?(x.type=='egreso'?[t('desde {0}',cn(g))]:ret?[cn(g),'→ '+WN(x.wallet)]:[WN(x.wallet),'→ '+cn(g)]):[x.type=='transferencia'?WN(x.wallet)+' → '+WN(x.to_wallet):WN(x.wallet),x.category,x.importance&&t(x.importance)];
return`<div class="mv" style="--c:${TC[k]}"><div class="ic">${TI[k]}</div><div class="tx"><div class="kind">${tl(k)}</div><div>${esc(x.detail||(x.type=='transferencia'?t('Pase de billetera'):x.category)||(g?(ret?t('Retiro de ahorro'):t('Ahorro')):tl(k)))}</div>
<div class="mut">${fdate(x.date,S.f.all&&S.view=='sem'||S.view=='res'?{weekday:'short',day:'numeric',month:'short',year:'2-digit'}:{weekday:'short',day:'numeric'})} ${tags.filter(Boolean).map(s=>`<span class="tag">${esc(s)}</span>`).join(' ')}</div></div>
<div class="am"><b style="color:var(--c)">${sg}${money(Math.abs(x.amount))}</b><br><button class="l" onclick="edit(${x.id})">${t('editar')}</button><button class="l" onclick="del(${x.id})">${t('borrar')}</button></div></div>`}
const fAct=()=>{const f=S.f;return f.all||f.types.length||f.min!==''||f.max!==''||f.wallet||f.q.trim()},upL=()=>{const e=$('#lst');if(e)e.innerHTML=lista()};
const fm=x=>{const f=S.f,q=f.q.trim().toLowerCase(),a=Math.abs(x.amount);return(!f.types.length||f.types.includes(x.type))&&(f.min===''||a>=+f.min)&&(f.max===''||a<=+f.max)&&(!f.wallet||x.wallet==f.wallet||x.to_wallet==f.wallet)&&(!q||[x.detail,x.category,x.importance].join(' ').toLowerCase().includes(q))};
function fT(k){const x=S.f.types;S.f.types=x.includes(k)?x.filter(y=>y!=k):[...x,k];render(1)}
function lista(){const base=S.f.all?S.movs:S.movs.filter(x=>x.date>=S.week&&x.date<=addD(S.week,6)),r=base.filter(fm);
return`${fAct()?`<p class="mut">${t('Mostrando {0} de {1} movimientos',r.length,base.length)}${S.f.all?' '+t('(todas las semanas)'):''}</p>`:''}<div class="card">${r.map(mvRow).join('')||(base.length?empty('🔎',t('Ningún movimiento coincide con los filtros.')):empty('🗒️',t('Sin movimientos. Tocá “+ Cargar” para agregar tu cobro.')))}</div>`}
function filtros(){const f=S.f;
return`<details ${S.fo||fAct()?'open':''} ontoggle="S.fo=this.open" class="card"><summary><b>${t('Filtros')}</b>${fAct()?` <span class="tag">${t('activos')}</span>`:''}</summary>
<div class="seg" style="margin-top:10px">${['ingreso','egreso','ahorro','transferencia','ajuste'].map(k=>`<button type="button" class="${f.types.includes(k)?'on':''}" onclick="fT('${k}')">${tl(k)}</button>`).join('')}</div>
<div class="grid"><div><label>${t('Monto mínimo')}</label><input type="number" inputmode="decimal" value="${esc(f.min)}" oninput="S.f.min=this.value;upL()"></div><div><label>${t('Monto máximo')}</label><input type="number" inputmode="decimal" value="${esc(f.max)}" oninput="S.f.max=this.value;upL()"></div></div>
<label>${t('Billetera')}</label><select onchange="S.f.wallet=this.value;upL()"><option value="">${t('Todas')}</option>${WK.map(k=>`<option value="${k}" ${f.wallet==k?'selected':''}>${WN(k)}</option>`).join('')}</select>
<label>${t('Buscar en detalle o categoría')}</label><input value="${esc(f.q)}" oninput="S.f.q=this.value;upL()">
<label class="ck" style="margin-top:12px"><input type="checkbox" ${f.all?'checked':''} onchange="S.f.all=this.checked;upL()"> ${t('Buscar en todas las semanas')}</label>
<button type="button" class="l lk" onclick="S.f={types:[],min:'',max:'',wallet:'',q:'',all:false};render(1)">${t('Limpiar filtros')}</button></details>`}

// Ahorros
function gst(g){const A=S.movs.filter(x=>x.goal_id==g.id),tot=A.reduce((s,x)=>s+(x.type=='egreso'?-x.amount:x.amount),0),dec=A.filter(x=>x.type=='egreso'&&x.dec_target).reduce((s,x)=>s+x.amount,0),tgt=Math.max(0,g.target-dec),
dep=A.filter(x=>x.type=='ahorro'&&x.amount>0),first=dep.map(x=>x.date).sort()[0],w=first?Math.max(1,Math.round((D(today())-D(first))/6048e5)):1,avg=dep.reduce((s,x)=>s+x.amount,0)/w;
return{A,tot,avg,dep,tgt,dec,pct:g.target?(tgt>0?Math.min(100,Math.max(0,tot)/tgt*100):100):0,eta:tgt&&avg>0&&tot<tgt?Math.ceil((tgt-tot)/avg):null}}
function ahorros(){const tot=S.goals.reduce((s,g)=>s+gst(g).tot,0);
return`<div class="row"><h1>${t('Ahorros')}</h1><button class="p" style="width:auto;padding:9px 14px" onclick="goalForm()">＋ ${t('Nueva caja')}</button></div>
${S.goals.length?`<div class="card hero"><div class="lbl">${t('Total en cajas de ahorro')}</div><div class="big">${money(tot)}</div></div>`:''}
<div class="gcards">${S.goals.map((g,i)=>{const s=gst(g);return`<div class="card kpi" style="--k:${PAL[i%PAL.length]};cursor:pointer" onclick="S.goal=${g.id};render()"><div class="row"><b>🐷 ${esc(g.name)}</b><b class="sv">${money(s.tot)}</b></div>
${g.target?`<div class="bar"><i style="width:${s.pct}%;background:${PAL[i%PAL.length]}"></i></div><div class="mut">${t('{0}% de {1}',Math.round(s.pct),money(s.tgt))}${s.dec?' '+t('(meta original {0})',money(g.target)):''}</div>`:`<div class="mut">${t('Sin meta')}</div>`}</div>`}).join('')}</div>
${S.goals.length?'':`<div class="card">${empty('🐷',t('Todavía no tenés cajas de ahorro. Creá una para separar plata para un objetivo (viaje, auto, emergencias…).'))}</div>`}`}
function goalForm(g){sheet(`<h2>${g?t('Editar caja'):t('Nueva caja de ahorro')}</h2><label>${t('Nombre')}</label><input name="name" required maxlength="60" value="${esc(g?g.name:'')}" placeholder="${t('Ej: Vacaciones')}">
<label>${t('Meta (opcional)')}</label><input name="target" type="number" step="any" min="0" inputmode="decimal" value="${g&&g.target||''}" placeholder="0 = ${t('sin meta')}">`,
async b=>{await api(g?'goals/'+g.id:'goals',g?'PUT':'POST',{name:b.name,target:+b.target||0});load()})}
function meta(){const g=S.goals.find(g=>g.id==S.goal);if(!g){S.goal=null;return ahorros()}const s=gst(g),last=s.dep[0];
return`<button class="l lk" onclick="S.goal=null;render()">‹ ${t('Ahorros')}</button><h1>🐷 ${esc(g.name)}</h1><div class="cols"><div>
<div class="card hero"><div class="lbl">${tip(t('Total ahorrado'),t('Plata que hay hoy en esta caja.'))}</div><div class="big">${money(s.tot)}</div>
${g.target?`<div class="bar" style="background:#fff3"><i style="width:${s.pct}%;background:#fff"></i></div><div class="lbl">${t('{0}% de {1}',Math.round(s.pct),money(s.tgt))}${s.dec?' '+t('(original {0}, ya pagaste {1} en cuotas)',money(g.target),money(s.dec)):''} · ${t('faltan {0}',money(Math.max(0,s.tgt-s.tot)))}</div>`:''}</div>
<div class="grid" style="margin-bottom:10px"><button class="p" onclick="openForm('ahorro',${g.id})">＋ ${t('Aportar')}</button><button class="p ghost" onclick="openForm('retiro',${g.id})">↩ ${t('Retirar')}</button></div>
<div class="kpis"><div class="card kpi" style="--k:var(--sv)"><div class="mut">${tip(t('Promedio semanal'),t('Aportes divididos por las semanas desde el primero.'))}</div><div class="v">${money(s.avg)}</div></div><div class="card kpi" style="--k:var(--acc)"><div class="mut">${tip(t('Aportes'),t('Cantidad de veces que aportaste.'))}</div><div class="v">${s.dep.length}</div></div>
<div class="card kpi" style="--k:var(--in)"><div class="mut">${tip(t('Último aporte'),t('Monto de tu aporte más reciente.'))}</div><div class="v">${last?money(last.amount):'—'}</div></div><div class="card kpi" style="--k:var(--tr)"><div class="mut">${tip(t('Meta en'),t('Semanas estimadas para llegar al objetivo al ritmo actual.'))}</div><div class="v">${s.eta?t('{0} semanas',s.eta):'—'}</div></div></div>
<div class="row"><button class="l lk" onclick="goalForm(S.goals.find(g=>g.id==${g.id}))">✎ ${t('Editar caja')}</button><button class="l" onclick="delGoal(${g.id})">${t('Eliminar caja')}</button></div></div>
<div><h2>${t('Movimientos de la caja')}</h2><div class="card">${s.A.map(mvRow).join('')||empty('🐷',t('Sin aportes todavía.'))}</div></div></div>`}
async function delGoal(id){if(confirm(t('¿Eliminar esta caja?')))try{await api('goals/'+id,'DELETE');S.goal=null;load()}catch(e){toast(e.message)}}

// Formularios
function sheet(html,onsub,o={}){const ov=document.createElement('div');ov.className='ov';
ov.innerHTML=`<form>${html}<p class="err"></p><button class="p${o.danger?' danger':''}">${o.submit||t('Guardar')}</button><button type="button" class="l x" style="width:100%">${t('Cancelar')}</button></form>`;
document.body.appendChild(ov);const f=ov.querySelector('form');ov.onclick=e=>{if(e.target==ov||e.target.classList.contains('x'))ov.remove()};
f.onsubmit=async e=>{e.preventDefault();const b=Object.fromEntries(new FormData(f));try{await onsub(b,f);ov.remove()}catch(x){f.querySelector('.err').textContent=x.message}};
setTimeout(()=>{const i=f.querySelector('input:not([type=hidden]):not([type=checkbox])');if(i&&matchMedia('(min-width:1024px)').matches)i.focus()});return f}
const CAT=['Comida','Transporte','Vivienda','Servicios','Salud','Ocio','Compras','Otros'];let T='egreso',LWV='virtual';
// mv: movimiento a editar. 'retiro' = ahorro con monto negativo (de la caja a una billetera); 'ajuste' = corrección de saldo
function openForm(type,gid,mv){const ret=mv&&mv.type=='ahorro'&&mv.amount<0;T=mv?(ret?'retiro':mv.type):type||'egreso';gid=mv?mv.goal_id:gid;
const WS=(n,l,v)=>`<label>${l}</label><select name="${n}">${WK.map(w=>`<option value="${w}" ${v==w?'selected':''}>${WV[w].ic} ${WN(w)}</option>`).join('')}</select>`;
const CJ=(l,o)=>`<label>${l}</label><select name="goal_id" required>${S.goals.map(g=>`<option value="${g.id}" ${g.id==gid?'selected':''}>🐷 ${esc(g.name)}${o?' ('+money(gst(g).tot)+')':''}</option>`).join('')||`<option value="">${t('Creá una caja primero')}</option>`}</select>`;
const w=mv?mv.date:S.view=='sem'&&!(today()>=S.week&&today()<=addD(S.week,6))?S.week:today(),tabs=['ingreso','egreso','ahorro','retiro','transferencia'].concat(T=='ajuste'?['ajuste']:[]),wv=mv?mv.wallet||LWV:LWV;
const f=sheet(`${mv?`<h2>${t('Editar movimiento')}</h2>`:''}<div class="seg">${tabs.map(k=>`<button type="button" data-t="${k}">${tl(k)}</button>`).join('')}</div>
<label>${t('Monto')}</label><input name="amount" type="number" step="any" inputmode="decimal" required value="${mv?(ret?-mv.amount:mv.amount):''}"><label>${t('Fecha')}</label><input name="date" type="date" value="${w}" required>
<label>${t('Detalle')}</label><input name="detail" maxlength="120" value="${esc(mv?mv.detail:'')}"><div id="x"></div>`,async b=>{b.type=T;b.amount=+b.amount;
if(T=='retiro'){b.type='ahorro';b.amount=-Math.abs(b.amount)}
if(T=='egreso'){const s=b.src;delete b.src;if(s[0]=='g'){b.goal_id=+s.slice(1);b.wallet='';b.dec_target=mv&&mv.goal_id==b.goal_id?mv.dec_target:0}else{b.wallet=s;b.goal_id=null}}
LWV=b.wallet||LWV;await api(mv?'movements/'+mv.id:'movements',mv?'PUT':'POST',b);load()});
const x=f.querySelector('#x');
const set=()=>{f.querySelectorAll('[data-t]').forEach(b=>b.classList.toggle('on',b.dataset.t==T));
x.innerHTML=T=='transferencia'?WS('wallet',t('Desde'),wv)+WS('to_wallet',t('Hacia'),mv&&mv.to_wallet||(wv=='virtual'?'efectivo':'virtual'))
:T=='ahorro'?WS('wallet',t('Desde la billetera'),wv)+CJ(t('Hacia la caja de ahorro'))
:T=='retiro'?CJ(t('Desde la caja de ahorro'),1)+WS('wallet',t('Hacia la billetera'),wv)
:T=='egreso'?`<label>${t('Se paga con')}</label><select name="src">${WK.map(k=>`<option value="${k}" ${wv==k&&!(mv&&mv.goal_id)?'selected':''}>${WV[k].ic} ${WN(k)}</option>`).join('')}${S.goals.map(g=>`<option value="g${g.id}" ${mv&&mv.goal_id==g.id?'selected':''}>🐷 ${esc(g.name)}</option>`).join('')}</select>
<label>${t('Categoría')}</label><input name="category" list="cats" value="${esc(mv?mv.category:'')}"><datalist id="cats">${CAT.map(c=>`<option>${t(c)}`).join('')}</datalist><label>${t('Importancia')}</label><select name="importance">${Object.keys(IMP).map(i=>`<option value="${i}" ${mv&&mv.importance==i?'selected':''}>${t(i)}`).join('')}</select>`
:T=='ajuste'?WS('wallet',t('Billetera'),wv)+`<p class="mut">${t('Corrección de saldo: suma (o resta, con monto negativo) a la billetera sin contar como ingreso ni gasto.')}</p>`
:WS('wallet',t('Billetera'),wv)+`<label>${t('Categoría')}</label><input name="category" placeholder="${t('Sueldo, extra…')}" value="${esc(mv?mv.category:'')}">`};set();
f.addEventListener('click',e=>{if(e.target.dataset.t){T=e.target.dataset.t;set()}})}

// Exportar a Excel
const flt=f=>S.movs.filter(x=>(!f.from||x.date>=f.from)&&(!f.to||x.date<=f.to)&&(!f.type||x.type==f.type)&&(!f.wallet||x.wallet==f.wallet||x.to_wallet==f.wallet)&&(!f.importance||x.importance==f.importance)&&(!f.category||x.category==f.category)&&(!f.goal||x.goal_id==f.goal));
async function saveFile(name,buf){const a=document.createElement('a');a.href=URL.createObjectURL(new Blob([buf],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));a.download=name;document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(a.href),1e4)}
function openExport(){const cats=[...new Set(S.movs.map(x=>x.category).filter(Boolean))].sort(),
sel=(n,l,o)=>`<label>${l}</label><select name="${n}"><option value="">${t('Todos')}</option>${o.map(([v,x])=>`<option value="${esc(v)}">${esc(x)}</option>`).join('')}</select>`;
const f=sheet(`<h2>${t('Exportar a Excel')}</h2><div class="grid"><div><label>${t('Desde')}</label><input type="date" name="from" value="${S.from}"></div><div><label>${t('Hasta')}</label><input type="date" name="to" value="${S.to}"></div></div>
${sel('type',t('Tipo'),['ingreso','egreso','ahorro','transferencia','ajuste'].map(k=>[k,tl(k)]))}${sel('wallet',t('Billetera'),WK.map(k=>[k,WN(k)]))}${sel('importance',t('Importancia'),Object.keys(IMP).map(x=>[x,t(x)]))}
${sel('category',t('Categoría'),cats.map(x=>[x,x]))}${sel('goal',t('Caja de ahorro'),S.goals.map(g=>[g.id,g.name]))}<p class="mut" id="cnt"></p>`,
async b=>{const r=flt(b);if(!r.length)throw new Error(t('No hay movimientos con esos filtros'));await doExport(r,b)},{submit:'⬇ '+t('Descargar Excel')});
const upd=()=>{f.querySelector('#cnt').textContent=t('{0} movimientos coinciden con los filtros',flt(Object.fromEntries(new FormData(f))).length)};upd();f.oninput=upd}
async function doExport(rows,f){if(!window.XLSX)throw new Error(t('No se pudo cargar el generador de Excel. Revisá tu conexión.'));
const sg=x=>x.type=='transferencia'?0:(x.type=='ingreso'||x.type=='ajuste')?x.amount:-x.amount,gn=id=>{const g=S.goals.find(g=>g.id==id);return g?g.name:''};
const R=[...rows].sort((a,b)=>a.date.localeCompare(b.date)||a.id-b.id).map(x=>({[t('Fecha')]:D(x.date),[t('Tipo')]:tl(x.type=='ahorro'&&x.amount<0?'retiro':x.type),[t('Detalle')]:x.detail,[t('Categoría')]:x.category,[t('Importancia')]:x.importance&&t(x.importance),[t('Billetera')]:WN(x.wallet),[t('Hacia')]:x.type=='transferencia'?WN(x.to_wallet):'',[t('Caja de ahorro')]:gn(x.goal_id),[t('Monto')]:x.amount,[t('Monto con signo')]:sg(x)}));
const K=['Ingresos','Correcciones','Gastos','Ahorro','Pagado con cajas'].map(k=>t(k)),mm={};rows.forEach(x=>{const r=mm[x.date.slice(0,7)]??={[t('Mes')]:x.date.slice(0,7),...Object.fromEntries(K.map(k=>[k,0]))};
if(x.type=='ingreso')r[K[0]]+=x.amount;else if(x.type=='ajuste')r[K[1]]+=x.amount;else if(x.type=='egreso'){r[K[2]]+=x.amount;if(x.goal_id)r[K[4]]+=x.amount}else if(x.type=='ahorro')r[K[3]]+=x.amount});
const M=Object.values(mm).sort((a,b)=>a[t('Mes')].localeCompare(b[t('Mes')])).map(r=>({...r,[t('Resultado')]:r[K[0]]+r[K[1]]-(r[K[2]]-r[K[4]])-r[K[3]],[t('Tasa de ahorro (%)')]:r[K[0]]?Math.round(r[K[3]]/r[K[0]]*1000)/10:0}));
const G=(k,n)=>{const g=grp(rows.filter(x=>x.type=='egreso'),k),s=g.reduce((s,[,v])=>s+v,0);return g.map(([a,v])=>({[n]:a,Total:v,[t('% del gasto')]:s?Math.round(v/s*1000)/10:0}))};
const wb=XLSX.utils.book_new(),add=(n,d,w)=>{const ws=XLSX.utils.json_to_sheet(d.length?d:[{Info:t('Sin datos')}],{dateNF:'dd/mm/yyyy'});ws['!cols']=w.map(c=>({wch:c}));ws['!autofilter']={ref:ws['!ref']};XLSX.utils.book_append_sheet(wb,ws,n)};
add(t('Movimientos'),R,[12,14,28,16,14,12,12,16,14,16]);add(t('Resumen mensual'),M,[10,14,14,14,14,18,14,18]);add(t('Gastos por categoría'),G('category',t('Categoría')),[22,14,12]);add(t('Gastos por importancia'),G('importance',t('Importancia')),[22,14,12]);
await saveFile(`cuentas_${f.from||'inicio'}_${f.to||today()}.xlsx`,new Uint8Array(XLSX.write(wb,{type:'array',bookType:'xlsx'})))}

// Cuotas
const FQ={mensual:'Mensual',semanal:'Semanal',dias:'Cada X días'};
const nth=(p,n)=>{const i=n-1;if(p.freq=='semanal')return addD(p.start,7*i);if(p.freq=='dias')return addD(p.start,p.every*i);
const d=D(p.start),y=d.getFullYear(),m=d.getMonth()+i,dim=new Date(y,m+1,0).getDate();return ds(new Date(y,m,Math.min(d.getDate(),dim)))};
const pst=p=>{const done=p.skip+S.movs.filter(x=>x.plan_id==p.id&&x.type=='egreso').length,rem=Math.max(0,p.total-done);return{done,rem,next:rem?nth(p,done+1):null,end:nth(p,p.total)}};
async function genCuotas(){let n=0;const x=today();for(const p of S.plans||[]){const have=new Set(S.movs.filter(m=>m.plan_id==p.id&&m.type=='egreso').map(m=>m.cuota_n));
for(let i=p.skip+1;i<=p.total;i++){const d=nth(p,i);if(d>x)break;if(have.has(i))continue;
try{await api('movements','POST',{type:'egreso',amount:p.amount,date:d,wallet:p.goal_id?'':p.wallet,goal_id:p.goal_id||null,dec_target:p.dec_target||0,category:'Cuotas',importance:'Necesario',detail:`${p.name} (${i}/${p.total})`,plan_id:p.id,cuota_n:i});
n++}catch(e){}}}return n}
function cuotas(){const t30=addD(today(),30);let deuda=0,prox=0;
const cards=(S.plans||[]).map((p,i)=>{const s=pst(p),g=S.goals.find(g=>g.id==p.goal_id);deuda+=p.amount*s.rem;for(let j=s.done+1;j<=p.total&&nth(p,j)<=t30;j++)prox+=p.amount;
return`<div class="card kpi" style="--k:${PAL[i%PAL.length]}"><div class="row"><b>📆 ${esc(p.name)}</b><b class="out">${money(p.amount)}</b></div><div class="bar"><i style="width:${s.done/p.total*100}%;background:${PAL[i%PAL.length]}"></i></div>
<div class="mut">${t('Cuota {0} de {1}',Math.min(s.done+1,p.total),p.total)} · ${t(FQ[p.freq])}${p.freq=='dias'?' ('+p.every+')':''} · ${t('pagado {0}',money(p.amount*s.done))} · ${t('falta {0}',money(p.amount*s.rem))}</div>
<div class="mut">${s.next?t('Próxima: {0}',fdd(s.next)):t('Plan completo')} · ${t('termina {0}',fdd(s.end))} · ${g?t('se paga con {0}',g.name)+(p.dec_target?' '+t('(también descuenta de la meta)'):''):t('se paga con {0}',WN(p.wallet))}</div><button class="l" onclick="delPlan(${p.id})">${t('Cancelar plan')}</button></div>`}).join('');
return`<div class="row"><h1>${t('Cuotas')}</h1><button class="p" style="width:auto;padding:9px 14px" onclick="openPlan()">＋ ${t('Nuevo plan')}</button></div>
<div class="kpis"><div class="card kpi" style="--k:var(--out)"><div class="mut">${tip(t('Próximos 30 días'),t('Total de cuotas que vencen en los próximos 30 días.'))}</div><div class="v out">${money(prox)}</div></div>
<div class="card kpi" style="--k:var(--acc)"><div class="mut">${tip(t('Deuda restante'),t('Suma de todas las cuotas que todavía faltan pagar.'))}</div><div class="v">${money(deuda)}</div></div></div>
<div class="gcards">${cards}</div>${cards?'':`<div class="card">${empty('📆',t('Todavía no cargaste cuotas. Creá un plan y la app descuenta cada cuota sola cuando vence.'))}</div>`}`}
async function delPlan(id){if(confirm(t('¿Cancelar este plan? Las cuotas ya descontadas se mantienen.'))){await api('plans/'+id,'DELETE');load()}}
function openPlan(){const f=sheet(`<h2>${t('Nuevo plan de cuotas')}</h2><label>${t('Nombre')}</label><input name="name" required maxlength="60" placeholder="${t('Ej: Celular')}">
<div class="grid"><div><label>${t('Monto por cuota')}</label><input name="amount" type="number" step="any" min="0" required></div><div><label>${t('Cantidad de cuotas')}</label><input name="total" type="number" min="1" max="600" required></div></div>
<div class="grid"><div><label>${t('Fecha de la 1ª cuota')}</label><input name="start" type="date" value="${today()}" required></div><div><label>${t('Ya pagadas')}</label><input name="skip" type="number" min="0" value="0"></div></div>
<label>${t('Frecuencia')}</label><select name="freq"><option value="mensual">${t('Mensual (mismo día de cada mes)')}</option><option value="semanal">${t('Semanal')}</option><option value="dias">${t('Cada X días')}</option></select>
<div id="ev" hidden><label>${t('Cada cuántos días')}</label><input name="every" type="number" min="1" value="15"></div>
<div id="wb"><label>${t('Se descuenta de la billetera')}</label><select name="wallet">${WK.map(w=>`<option value="${w}">${WV[w].ic} ${WN(w)}</option>`).join('')}</select></div>
<label>${t('Pagar con una caja de ahorro (opcional)')}</label><select name="goal_id"><option value="">${t('No, pagar con una billetera')}</option>${S.goals.map(g=>`<option value="${g.id}">🐷 ${esc(g.name)}</option>`).join('')}</select>
<div id="dt" hidden><label class="ck"><input type="checkbox" name="dec_target"> ${t('Descontar también cada cuota de la meta de la caja')}</label></div>`,
async b=>{b.amount=+b.amount;b.total=+b.total;b.skip=+b.skip||0;b.every=+b.every||0;b.goal_id=b.goal_id||null;b.dec_target=b.goal_id&&b.dec_target?1:0;if(b.goal_id)b.wallet='';await api('plans','POST',b);load()},{submit:t('Crear plan')});
f.onchange=()=>{const gs=!!f.elements.goal_id.value;f.querySelector('#ev').hidden=f.elements.freq.value!='dias';f.querySelector('#wb').hidden=gs;f.querySelector('#dt').hidden=!gs}}

// Configuración
function config(){const s=S.settings,th=s.theme||'claro',lg=s.lang||'es';
return`<div class="narrow"><h1>⚙️ ${t('Configuración')}</h1>
<h2>${t('Idioma')}</h2><div class="card"><div class="seg">${[['es','🇦🇷 Español'],['en','🇺🇸 English']].map(([k,n])=>`<button type="button" class="${lg==k?'on':''}" onclick="setS('lang','${k}')">${n}</button>`).join('')}</div></div>
<h2>${t('Tema')}</h2><div class="themes">${THEMES.map(([k,n,c])=>`<button type="button" class="th ${th==k?'on':''}" onclick="setS('theme','${k}')"><div class="sw">${c.map(x=>`<i style="background:${x}"></i>`).join('')}</div><b>${t(n)}</b>${th==k?' ✓':''}</button>`).join('')}</div>
<p class="mut">${t('Se guarda en tu cuenta: vas a ver lo mismo en el celular y en la computadora.')}</p></div>`}

// Cuenta
const WORDS=['naranja','galaxia','pinguino','alfajor','brujula','lechuza','cometa','tornillo','glaciar','mandarina','yacare','tucan','tango','volcan','pomelo'];
function cuenta(){return`<div class="narrow"><h1>👤 ${t('Cuenta')}</h1>
<div class="card"><div class="wal"><div class="ic" style="--wc:var(--acc)">👤</div><div><div class="mut">${t('Usuario')}</div><b style="font-size:18px">${esc(S.username)}</b></div></div></div>
<h2>${t('Cambiar usuario')}</h2><form class="card" onsubmit="acc(event)"><label>${t('Usuario nuevo')}</label><input name="username" required minlength="3" maxlength="30" autocomplete="username" autocapitalize="off">
<label>${t('Contraseña actual')}</label><input name="password" type="password" required autocomplete="current-password"><p class="err"></p><button class="p">${t('Guardar usuario')}</button></form>
<h2>${t('Cambiar contraseña')}</h2><form class="card" onsubmit="acc(event)"><label>${t('Contraseña actual')}</label><input name="password" type="password" required autocomplete="current-password">
<label>${t('Contraseña nueva')}</label><input name="new_password" type="password" required minlength="8" autocomplete="new-password"><label>${t('Repetí la contraseña nueva')}</label><input name="rep" type="password" required minlength="8" autocomplete="new-password">
<p class="err"></p><button class="p">${t('Guardar contraseña')}</button></form>
<h2 class="out">${t('Zona de peligro')}</h2><div class="card" style="border-color:color-mix(in srgb,var(--out) 45%,transparent)"><b>🧨 ${t('Formatear cuenta')}</b><p class="mut">${t('Borra los datos que elijas para empezar de cero. No se puede deshacer desde la app.')}</p><button class="p danger" onclick="openReset()">${t('Formatear cuenta…')}</button></div>
<button class="p ghost" style="margin-top:14px" onclick="logout()">🚪 ${t('Cerrar sesión')}</button></div>`}
async function acc(e){e.preventDefault();const f=e.target,b=Object.fromEntries(new FormData(f)),m=f.querySelector('.err');
if(b.rep!==undefined&&b.new_password!==b.rep){m.textContent=t('Las contraseñas nuevas no coinciden');return}delete b.rep;
try{const r=await api('account','PUT',b);S.username=r.username;render(1);toast(b.new_password?t('Contraseña actualizada'):t('Usuario actualizado'))}catch(x){m.textContent=x.message}}
function openReset(){const w=WORDS[Math.floor(Math.random()*WORDS.length)]+'-'+(10+Math.floor(Math.random()*90));
sheet(`<h2 class="out">⚠️ ${t('Formatear cuenta')}</h2><p>${t('Elegí qué querés borrar:')}</p>
${[['movimientos','Movimientos (ingresos, gastos, pases y correcciones)'],['cajas','Cajas de ahorro (con sus aportes y retiros)'],['cuotas','Planes de cuotas'],['configuracion','Configuración (idioma y tema)']].map(([k,n])=>`<label class="ck" style="margin:8px 0"><input type="checkbox" name="w_${k}"> ${t(n)}</label>`).join('')}
<div class="warn">${t('Si borrás los movimientos pero no los planes de cuotas, las cuotas ya vencidas se vuelven a cargar solas.')}</div>
<label>${t('Para confirmar, escribí esta palabra:')}</label><div class="word">${w}</div><input name="word" autocomplete="off" autocapitalize="off" spellcheck="false" required>
<label>${t('Tu contraseña')}</label><input name="password" type="password" required autocomplete="current-password">`,
async b=>{const what=Object.keys(b).filter(k=>k.startsWith('w_')).map(k=>k.slice(2));if(!what.length)throw new Error(t('Elegí qué querés borrar'));
if(b.word.trim().toLowerCase()!==w)throw new Error(t('La palabra no coincide'));await api('reset','POST',{password:b.password,what});S.view='res';S.goal=null;toast(t('Listo, cuenta formateada'));load()},{submit:t('Formatear'),danger:1})}

load();
