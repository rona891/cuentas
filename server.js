const express=require('express'),{DatabaseSync:DB}=require('node:sqlite'),bcrypt=require('bcryptjs'),jwt=require('jsonwebtoken'),cp=require('cookie-parser'),fs=require('fs'),crypto=require('crypto');
fs.mkdirSync('data',{recursive:true});
const SECRET=process.env.JWT_SECRET||(fs.existsSync('data/secret')?fs.readFileSync('data/secret','utf8'):(s=>(fs.writeFileSync('data/secret',s),s))(crypto.randomBytes(32).toString('hex')));
const db=new DB('data/cuentas.db');db.exec('PRAGMA journal_mode=WAL;PRAGMA foreign_keys=ON');
db.exec(`CREATE TABLE IF NOT EXISTS users(id INTEGER PRIMARY KEY,username TEXT UNIQUE NOT NULL,hash TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS goals(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),name TEXT NOT NULL,target REAL DEFAULT 0);
CREATE TABLE IF NOT EXISTS movements(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),date TEXT NOT NULL,type TEXT NOT NULL,amount REAL NOT NULL,
category TEXT DEFAULT '',detail TEXT DEFAULT '',importance TEXT DEFAULT '',method TEXT DEFAULT '',goal_id INTEGER REFERENCES goals(id),wallet TEXT DEFAULT 'virtual',to_wallet TEXT DEFAULT '');
CREATE INDEX IF NOT EXISTS mv ON movements(user_id,date);`);
if(!db.prepare("SELECT 1 FROM pragma_table_info('movements') WHERE name='wallet'").get())db.exec("ALTER TABLE movements ADD COLUMN wallet TEXT DEFAULT 'virtual';ALTER TABLE movements ADD COLUMN to_wallet TEXT DEFAULT '';UPDATE movements SET wallet='efectivo' WHERE method='Efectivo'");
db.exec("CREATE TABLE IF NOT EXISTS plans(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),name TEXT NOT NULL,amount REAL NOT NULL,total INTEGER NOT NULL,skip INTEGER DEFAULT 0,start TEXT NOT NULL,freq TEXT NOT NULL,every INTEGER DEFAULT 0,wallet TEXT NOT NULL,goal_id INTEGER)");
if(!db.prepare("SELECT 1 FROM pragma_table_info('movements') WHERE name='plan_id'").get())db.exec("ALTER TABLE movements ADD COLUMN plan_id INTEGER;ALTER TABLE movements ADD COLUMN cuota_n INTEGER");
if(!db.prepare("SELECT 1 FROM pragma_table_info('movements') WHERE name='dec_target'").get())db.exec("ALTER TABLE movements ADD COLUMN dec_target INTEGER DEFAULT 0");
if(!db.prepare("SELECT 1 FROM pragma_table_info('plans') WHERE name='dec_target'").get())db.exec("ALTER TABLE plans ADD COLUMN dec_target INTEGER DEFAULT 0");
db.exec("CREATE UNIQUE INDEX IF NOT EXISTS uq_cuota ON movements(plan_id,cuota_n) WHERE type='egreso' AND plan_id IS NOT NULL");
// v1: los ajustes viejos pasan a ser ingresos; desde acá 'ajuste' = corrección de saldo
if(!db.prepare('PRAGMA user_version').get().user_version)db.exec("UPDATE movements SET type='ingreso',category=CASE WHEN category='' THEN 'Sueldo' ELSE category END WHERE type='ajuste';PRAGMA user_version=1");
if(!db.prepare("SELECT 1 FROM pragma_table_info('users') WHERE name='settings'").get())db.exec("ALTER TABLE users ADD COLUMN settings TEXT DEFAULT '{}'");
const SET={lang:['es','en'],theme:['claro','oscuro','medianoche','crema'],totals:['ambos','separado','una'],tour:['nuevo','ofrecer','hecho'],pasos:['on','off']},getSet=uid=>{try{return JSON.parse(db.prepare('SELECT settings FROM users WHERE id=?').get(uid).settings||'{}')}catch{return{}}};
// v2: monedas, billeteras y categorías propias de cada usuario; cajas con una o más monedas.
// En movements: amount va en la moneda de wallet_id (o de goal_cur si no hay billetera); amount2 es el otro lado
// cuando hay cambio de moneda (to_wallet_id en pases, goal_cur en aportes/retiros, goal_cur2 en 'cambio' dentro de una caja).
db.exec(`CREATE TABLE IF NOT EXISTS currencies(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),code TEXT NOT NULL,name TEXT NOT NULL,symbol TEXT NOT NULL,rate REAL NOT NULL,base INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS wallets(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),name TEXT NOT NULL,currency_id INTEGER NOT NULL REFERENCES currencies(id),color TEXT DEFAULT '#2563EB',icon TEXT DEFAULT '👛',archived INTEGER DEFAULT 0,sort INTEGER DEFAULT 0);
CREATE TABLE IF NOT EXISTS categories(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),name TEXT NOT NULL,kind TEXT NOT NULL,color TEXT DEFAULT '#5B4FE0',icon TEXT DEFAULT '🏷️')`);
const addCol=(t,c,d)=>{if(!db.prepare(`SELECT 1 FROM pragma_table_info('${t}') WHERE name=?`).get(c))db.exec(`ALTER TABLE ${t} ADD COLUMN ${c} ${d}`)};
[['movements','wallet_id','INTEGER'],['movements','to_wallet_id','INTEGER'],['movements','amount2','REAL'],['movements','goal_cur','INTEGER'],['movements','goal_cur2','INTEGER'],
['goals','currency_id','INTEGER'],['goals','currencies',"TEXT DEFAULT ''"],['plans','wallet_id','INTEGER']].forEach(c=>addCol(...c));
const PAL=['#5B4FE0','#0E9F6E','#E5484D','#2F7BEA','#D97706','#C026D3','#0891B2','#65A30D','#DB2777','#7C3AED'];
const CATS={egreso:[['Comida','🍔'],['Transporte','🚌'],['Vivienda','🏠'],['Servicios','💡'],['Salud','💊'],['Ocio','🎉'],['Compras','🛍️'],['Cuotas','📆'],['Otros','📦']],ingreso:[['Sueldo','💼'],['Extra','✨'],['Otros ingresos','💰']]};
// Prioridades de los gastos (antes "importancia"): los movimientos guardan el nombre en movements.importance
const PRIOS=[['Necesario','🔴','#E5484D'],['Útil','🟡','#D97706'],['Gusto','🟢','#0E9F6E']];
db.exec("CREATE TABLE IF NOT EXISTS priorities(id INTEGER PRIMARY KEY,user_id INTEGER NOT NULL REFERENCES users(id),name TEXT NOT NULL,color TEXT DEFAULT '#5B4FE0',icon TEXT DEFAULT '🚦',sort INTEGER DEFAULT 0)");
function seed(uid,{cur,wal,cat,pri}){let ars=null;
if(pri){const p=db.prepare('INSERT INTO priorities(user_id,name,icon,color,sort) VALUES(?,?,?,?,?)');PRIOS.forEach(([n,ic,c],i)=>p.run(uid,n,ic,c,i+1))}
if(cur)ars=db.prepare("INSERT INTO currencies(user_id,code,name,symbol,rate,base) VALUES(?,'ARS','Peso argentino','$',1,1)").run(uid).lastInsertRowid;
if(wal){ars??=db.prepare('SELECT id FROM currencies WHERE user_id=? AND base=1').get(uid).id;const w=db.prepare('INSERT INTO wallets(user_id,name,currency_id,color,icon,sort) VALUES(?,?,?,?,?,?)');
return{efectivo:w.run(uid,'Efectivo',ars,'#16A34A','💵',1).lastInsertRowid,virtual:w.run(uid,'Virtual',ars,'#2563EB','💳',2).lastInsertRowid,ars}}
if(cat){const c=db.prepare('INSERT INTO categories(user_id,name,kind,color,icon) VALUES(?,?,?,?,?)');let i=0;for(const k in CATS)for(const[n,ic]of CATS[k])c.run(uid,n,k,PAL[i++%PAL.length],ic)}}
const ensurePrio=(uid,name)=>{if(name&&!db.prepare('SELECT 1 FROM priorities WHERE user_id=? AND name=?').get(uid,name)){const n=db.prepare('SELECT COALESCE(MAX(sort),0)+1 n FROM priorities WHERE user_id=?').get(uid).n;
db.prepare('INSERT INTO priorities(user_id,name,icon,color,sort) VALUES(?,?,?,?,?)').run(uid,name,'🚦',PAL[n%PAL.length],n)}};
const ensureCat=(uid,name,kind)=>{if(name&&['ingreso','egreso'].includes(kind)&&!db.prepare('SELECT 1 FROM categories WHERE user_id=? AND kind=? AND name=?').get(uid,kind,name)){
const n=db.prepare('SELECT COUNT(*) n FROM categories WHERE user_id=?').get(uid).n;db.prepare('INSERT INTO categories(user_id,name,kind,color,icon) VALUES(?,?,?,?,?)').run(uid,name,kind,PAL[n%PAL.length],'🏷️')}};
if(db.prepare('PRAGMA user_version').get().user_version<2){db.exec('BEGIN');try{for(const{id:u}of db.prepare('SELECT id FROM users').all()){
const ids=seed(u,{cur:1,wal:1});seed(u,{cat:1});
for(const w of['efectivo','virtual']){db.prepare('UPDATE movements SET wallet_id=? WHERE user_id=? AND wallet=? AND (goal_id IS NULL OR type<>?)').run(ids[w],u,w,'egreso');
db.prepare("UPDATE movements SET to_wallet_id=? WHERE user_id=? AND type='transferencia' AND to_wallet=?").run(ids[w],u,w);db.prepare('UPDATE plans SET wallet_id=? WHERE user_id=? AND wallet=? AND goal_id IS NULL').run(ids[w],u,w)}
db.prepare('UPDATE movements SET goal_cur=? WHERE user_id=? AND goal_id IS NOT NULL').run(ids.ars,u);db.prepare("UPDATE goals SET currency_id=?,currencies=? WHERE user_id=?").run(ids.ars,String(ids.ars),u);
for(const r of db.prepare("SELECT DISTINCT type,category FROM movements WHERE user_id=? AND category<>'' AND type IN ('ingreso','egreso')").all(u))ensureCat(u,r.category,r.type)}
db.exec('PRAGMA user_version=2;COMMIT')}catch(e){db.exec('ROLLBACK');throw e}}
if(db.prepare('PRAGMA user_version').get().user_version<3){db.exec('BEGIN');try{for(const{id:u}of db.prepare('SELECT id FROM users').all()){
db.prepare("UPDATE movements SET importance=CASE importance WHEN 'Esencial' THEN 'Necesario' WHEN 'Necesario' THEN 'Útil' WHEN 'Prescindible' THEN 'Gusto' ELSE importance END WHERE user_id=?").run(u);
seed(u,{pri:1});for(const r of db.prepare("SELECT DISTINCT importance FROM movements WHERE user_id=? AND importance<>''").all(u))ensurePrio(u,r.importance)}
db.exec('PRAGMA user_version=3;COMMIT')}catch(e){db.exec('ROLLBACK');throw e}}
// v4: a los usuarios que ya existían se les ofrece una vez el recorrido guiado (los nuevos arrancan con tour='nuevo')
if(db.prepare('PRAGMA user_version').get().user_version<4){db.exec('BEGIN');try{for(const r of db.prepare('SELECT id,settings FROM users').all()){let s;try{s=JSON.parse(r.settings||'{}')}catch{s={}}
if(!s.tour){s.tour='ofrecer';db.prepare('UPDATE users SET settings=? WHERE id=?').run(JSON.stringify(s),r.id)}}
db.exec('PRAGMA user_version=4;COMMIT')}catch(e){db.exec('ROLLBACK');throw e}}
const cleanIcon=(v,d)=>{v=String(v||'');if(v.startsWith('data:image/'))return/^data:image\/png;base64,[A-Za-z0-9+/]+=*$/.test(v)&&v.length<=60000?v:null;return v.replace(/[<>&"']/g,'').slice(0,8)||d};
const own=(tbl,id,uid)=>id?db.prepare(`SELECT * FROM ${tbl} WHERE id=? AND user_id=?`).get(id,uid):null;
const goalCurs=g=>String(g.currencies||g.currency_id).split(',').filter(Boolean).map(Number);
const app=express();app.set('trust proxy',1);app.use(express.json({limit:'200kb'}),cp());
// index.html pide app.js/app.css/i18n.js con ?v=<arranque>: Cloudflare hace que el navegador los guarde 4 h, así cada deploy fuerza la versión nueva
const V=Date.now().toString(36),INDEX=fs.readFileSync('public/index.html','utf8').replace(/(app\.css|app\.js|i18n\.js|tour\.js)"/g,`$1?v=${V}"`);
app.get(['/','/index.html'],(req,res)=>res.set('Cache-Control','no-cache').type('html').send(INDEX));app.use(express.static('public'));
const err=(res,c,m)=>res.status(c).json({error:m});
const login=(res,u)=>res.cookie('tk',jwt.sign({uid:u.id},SECRET,{expiresIn:'30d'}),{httpOnly:true,sameSite:'lax',secure:process.env.COOKIE_SECURE==='1',maxAge:30*864e5}).json({username:u.username});
// Anti fuerza bruta: hasta 10 intentos fallidos cada 15 min por persona. Detrás de Cloudflare, req.ip es la IP de Cloudflare
// (compartida por muchos usuarios), así que se usa la IP real que manda en CF-Connecting-IP.
const tries={};const limit=(req,res,next)=>{const k=req.get('cf-connecting-ip')||req.ip,t=Date.now();tries[k]=(tries[k]||[]).filter(x=>t-x<9e5);
if(tries[k].length>=10)return err(res,429,'Demasiados intentos, esperá unos minutos');res.on('finish',()=>{if(res.statusCode>=400)tries[k].push(Date.now())});next()};
app.post('/api/register',limit,(req,res)=>{if(process.env.ALLOW_REGISTER==='0')return err(res,403,'Registro deshabilitado');
const{username,password}=req.body;if(!/^[\w.-]{3,30}$/.test(username||'')||(password||'').length<8)return err(res,400,'Usuario (3-30 caracteres) y contraseña (mín. 8)');
let r;try{r=db.prepare('INSERT INTO users(username,hash) VALUES(?,?)').run(username.toLowerCase(),bcrypt.hashSync(password,10))}catch{return err(res,409,'Ese usuario ya existe')}
seed(r.lastInsertRowid,{cur:1,wal:1});seed(r.lastInsertRowid,{cat:1,pri:1});db.prepare('UPDATE users SET settings=? WHERE id=?').run(JSON.stringify({tour:'nuevo',pasos:'on'}),r.lastInsertRowid);login(res,{id:r.lastInsertRowid,username})});
app.post('/api/login',limit,(req,res)=>{const u=db.prepare('SELECT * FROM users WHERE username=?').get(String(req.body.username||'').toLowerCase());
if(!u||!bcrypt.compareSync(String(req.body.password||''),u.hash))return err(res,401,'Usuario o contraseña incorrectos');login(res,u)});
app.post('/api/logout',(q,res)=>res.clearCookie('tk').json({}));
app.use('/api',(req,res,next)=>{try{const p=jwt.verify(req.cookies.tk,SECRET);if(!db.prepare('SELECT 1 FROM users WHERE id=?').get(p.uid))throw 0;req.uid=p.uid;next()}catch{err(res,401,'No autenticado')}});
app.get('/api/me',(req,res)=>res.json(db.prepare('SELECT username FROM users WHERE id=?').get(req.uid)));
app.put('/api/settings',(req,res)=>{const s=getSet(req.uid);for(const[k,v]of Object.entries(req.body||{}))if(SET[k]&&SET[k].includes(v))s[k]=v;
// pv: pasos de "Primeros pasos" que no se deducen de los datos (secciones visitadas, visita guiada hecha)
if(req.body&&typeof req.body.pv=='string'&&/^[a-z,]{0,80}$/.test(req.body.pv))s.pv=req.body.pv;
if(req.body&&req.body.tcur!==undefined&&own('currencies',+req.body.tcur,req.uid))s.tcur=+req.body.tcur;
db.prepare('UPDATE users SET settings=? WHERE id=?').run(JSON.stringify(s),req.uid);res.json(s)});
const checkPw=(req,res)=>{const u=db.prepare('SELECT * FROM users WHERE id=?').get(req.uid);if(!u||!bcrypt.compareSync(String(req.body.password||''),u.hash)){err(res,401,'La contraseña actual no es correcta');return null}return u};
app.put('/api/account',limit,(req,res)=>{const u=checkPw(req,res);if(!u)return;const b=req.body;
if(b.username!==undefined){const n=String(b.username).toLowerCase();if(!/^[\w.-]{3,30}$/.test(n))return err(res,400,'El usuario debe tener entre 3 y 30 caracteres (letras, números, punto, guion)');
try{db.prepare('UPDATE users SET username=? WHERE id=?').run(n,u.id)}catch{return err(res,409,'Ese usuario ya existe')}}
if(b.new_password!==undefined){if(String(b.new_password).length<8)return err(res,400,'La contraseña nueva debe tener al menos 8 caracteres');db.prepare('UPDATE users SET hash=? WHERE id=?').run(bcrypt.hashSync(String(b.new_password),10),u.id)}
res.json(db.prepare('SELECT username FROM users WHERE id=?').get(u.id))});
// Formatear: borra lo que el usuario elija. Borrar cajas arrastra sus movimientos y los planes que se pagan con ellas;
// billeteras y monedas vuelven a Efectivo y Virtual en pesos, y eso obliga a borrar también movimientos, cajas y cuotas.
app.post('/api/reset',limit,(req,res)=>{const u=checkPw(req,res);if(!u)return;const w=new Set(Array.isArray(req.body.what)?req.body.what:[]),q=s=>db.prepare(s).run(u.id);
if(!w.size)return err(res,400,'Elegí qué querés borrar');if(w.has('billeteras'))['movimientos','cajas','cuotas'].forEach(x=>w.add(x));db.exec('BEGIN');try{
if(w.has('movimientos'))q('DELETE FROM movements WHERE user_id=?');
if(w.has('cuotas'))q('DELETE FROM plans WHERE user_id=?');
if(w.has('cajas')){q('DELETE FROM movements WHERE user_id=? AND goal_id IS NOT NULL');q('DELETE FROM plans WHERE user_id=? AND goal_id IS NOT NULL');q('DELETE FROM goals WHERE user_id=?')}
if(w.has('billeteras')){q('DELETE FROM wallets WHERE user_id=?');q('DELETE FROM currencies WHERE user_id=?');seed(u.id,{cur:1,wal:1})}
if(w.has('categorias')){q('DELETE FROM categories WHERE user_id=?');seed(u.id,{cat:1})}
if(w.has('prioridades')){q('DELETE FROM priorities WHERE user_id=?');seed(u.id,{pri:1})}
if(w.has('configuracion'))q("UPDATE users SET settings='{}' WHERE id=?");
db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');return err(res,500,'No se pudo formatear')}res.json({})});
// Eliminar la cuenta por completo: borra todos sus datos y el usuario, y cierra la sesión
app.post('/api/account/delete',limit,(req,res)=>{const u=checkPw(req,res);if(!u)return;db.exec('BEGIN');try{
for(const t of['movements','plans','goals','wallets','categories','priorities','currencies'])db.prepare(`DELETE FROM ${t} WHERE user_id=?`).run(u.id);
db.prepare('DELETE FROM users WHERE id=?').run(u.id);db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');return err(res,500,'No se pudo eliminar la cuenta')}res.clearCookie('tk').json({})});
app.get('/api/data',(req,res)=>{const u=req.uid,all=t=>db.prepare(`SELECT * FROM ${t} WHERE user_id=?`).all(u);res.json({username:db.prepare('SELECT username FROM users WHERE id=?').get(u).username,settings:getSet(u),
movs:db.prepare('SELECT * FROM movements WHERE user_id=? ORDER BY date DESC,id DESC').all(u),goals:all('goals'),plans:all('plans'),currencies:db.prepare('SELECT * FROM currencies WHERE user_id=? ORDER BY base DESC,code').all(u),
wallets:db.prepare('SELECT * FROM wallets WHERE user_id=? ORDER BY archived,sort,id').all(u),categories:db.prepare('SELECT * FROM categories WHERE user_id=? ORDER BY kind,name').all(u),priorities:db.prepare('SELECT * FROM priorities WHERE user_id=? ORDER BY sort,id').all(u)})});

// Monedas: rate = cuántos pesos (moneda base) vale 1 unidad
const curData=(b,base)=>{const code=String(b.code||'').trim().toUpperCase(),name=String(b.name||'').trim().slice(0,30),symbol=String(b.symbol||'').replace(/[<>&"']/g,'').trim().slice(0,5),rate=+b.rate;
return(!base&&!/^[A-Z0-9]{2,6}$/.test(code))||!name||!symbol||(!base&&!(rate>0))?null:{code,name,symbol,rate}};
app.post('/api/currencies',(req,res)=>{const c=curData(req.body);if(!c)return err(res,400,'Revisá los datos de la moneda');
if(db.prepare('SELECT 1 FROM currencies WHERE user_id=? AND code=?').get(req.uid,c.code))return err(res,409,'Ya tenés una moneda con ese código');
res.json({id:db.prepare('INSERT INTO currencies(user_id,code,name,symbol,rate) VALUES(?,?,?,?,?)').run(req.uid,c.code,c.name,c.symbol,c.rate).lastInsertRowid})});
app.put('/api/currencies/:id',(req,res)=>{const o=own('currencies',+req.params.id,req.uid);if(!o)return err(res,404,'No existe esa moneda');const c=curData(req.body,o.base);if(!c)return err(res,400,'Revisá los datos de la moneda');
if(o.base)db.prepare('UPDATE currencies SET name=?,symbol=? WHERE id=?').run(c.name,c.symbol,o.id);
else{if(db.prepare('SELECT 1 FROM currencies WHERE user_id=? AND code=? AND id<>?').get(req.uid,c.code,o.id))return err(res,409,'Ya tenés una moneda con ese código');
db.prepare('UPDATE currencies SET code=?,name=?,symbol=?,rate=? WHERE id=?').run(c.code,c.name,c.symbol,c.rate,o.id)}res.json({})});
app.delete('/api/currencies/:id',(req,res)=>{const o=own('currencies',+req.params.id,req.uid),u=req.uid;if(!o)return err(res,404,'No existe esa moneda');if(o.base)return err(res,400,'La moneda base no se puede borrar');
if(db.prepare('SELECT 1 FROM wallets WHERE user_id=? AND currency_id=?').get(u,o.id)||db.prepare('SELECT 1 FROM goals WHERE user_id=? AND (currency_id=? OR (\',\'||currencies||\',\') LIKE ?)').get(u,o.id,'%,'+o.id+',%')
||db.prepare('SELECT 1 FROM movements WHERE user_id=? AND (goal_cur=? OR goal_cur2=?)').get(u,o.id,o.id))return err(res,400,'Esa moneda está en uso en billeteras, cajas o movimientos');
const s=getSet(u);if(s.tcur==o.id){delete s.tcur;db.prepare('UPDATE users SET settings=? WHERE id=?').run(JSON.stringify(s),u)}
db.prepare('DELETE FROM currencies WHERE id=?').run(o.id);res.json({})});

// Billeteras: con movimientos no se borran (se archivan) ni cambian de moneda
const walUsed=(uid,id)=>db.prepare('SELECT 1 FROM movements WHERE user_id=? AND (wallet_id=? OR to_wallet_id=?)').get(uid,id,id)||db.prepare('SELECT 1 FROM plans WHERE user_id=? AND wallet_id=?').get(uid,id);
const walData=(b,uid)=>{const name=String(b.name||'').trim().slice(0,40);return name&&own('currencies',+b.currency_id,uid)?{name,currency_id:+b.currency_id,color:/^#[0-9a-fA-F]{6}$/.test(b.color)?b.color:'#2563EB',icon:cleanIcon(b.icon,'👛')}:null};
app.post('/api/wallets',(req,res)=>{const w=walData(req.body,req.uid);if(w&&!w.icon)return err(res,400,'El ícono subido no es válido');if(!w)return err(res,400,'Poné un nombre y elegí la moneda');
const s=db.prepare('SELECT COALESCE(MAX(sort),0)+1 s FROM wallets WHERE user_id=?').get(req.uid).s;
res.json({id:db.prepare('INSERT INTO wallets(user_id,name,currency_id,color,icon,sort) VALUES(?,?,?,?,?,?)').run(req.uid,w.name,w.currency_id,w.color,w.icon,s).lastInsertRowid})});
app.put('/api/wallets/:id',(req,res)=>{const o=own('wallets',+req.params.id,req.uid);if(!o)return err(res,404,'No existe esa billetera');const w=walData({...o,...req.body},req.uid);if(w&&!w.icon)return err(res,400,'El ícono subido no es válido');if(!w)return err(res,400,'Poné un nombre y elegí la moneda');
if(w.currency_id!==o.currency_id&&walUsed(req.uid,o.id))return err(res,400,'La billetera ya tiene movimientos: no se le puede cambiar la moneda');
db.prepare('UPDATE wallets SET name=?,currency_id=?,color=?,icon=?,archived=? WHERE id=?').run(w.name,w.currency_id,w.color,w.icon,req.body.archived===undefined?o.archived:(req.body.archived?1:0),o.id);res.json({})});
app.delete('/api/wallets/:id',(req,res)=>{const o=own('wallets',+req.params.id,req.uid);if(!o)return err(res,404,'No existe esa billetera');
if(walUsed(req.uid,o.id))return err(res,400,'La billetera tiene movimientos o cuotas: archivala en lugar de borrarla');db.prepare('DELETE FROM wallets WHERE id=?').run(o.id);res.json({})});

// Categorías: los movimientos guardan el nombre; renombrar actualiza los movimientos de ese tipo
const catData=b=>{const name=String(b.name||'').trim().slice(0,40);return name&&['ingreso','egreso'].includes(b.kind)?{name,kind:b.kind,color:/^#[0-9a-fA-F]{6}$/.test(b.color)?b.color:'#5B4FE0',icon:cleanIcon(b.icon,'🏷️')}:null};
app.post('/api/categories',(req,res)=>{const c=catData(req.body);if(c&&!c.icon)return err(res,400,'El ícono subido no es válido');if(!c)return err(res,400,'Poné un nombre a la categoría');
if(db.prepare('SELECT 1 FROM categories WHERE user_id=? AND kind=? AND name=?').get(req.uid,c.kind,c.name))return err(res,409,'Esa categoría ya existe');
res.json({id:db.prepare('INSERT INTO categories(user_id,name,kind,color,icon) VALUES(?,?,?,?,?)').run(req.uid,c.name,c.kind,c.color,c.icon).lastInsertRowid})});
app.put('/api/categories/:id',(req,res)=>{const o=own('categories',+req.params.id,req.uid);if(!o)return err(res,404,'No existe esa categoría');const c=catData({...req.body,kind:o.kind});if(c&&!c.icon)return err(res,400,'El ícono subido no es válido');if(!c)return err(res,400,'Poné un nombre a la categoría');
if(c.name!==o.name&&db.prepare('SELECT 1 FROM categories WHERE user_id=? AND kind=? AND name=?').get(req.uid,o.kind,c.name))return err(res,409,'Esa categoría ya existe');
db.exec('BEGIN');db.prepare('UPDATE categories SET name=?,color=?,icon=? WHERE id=?').run(c.name,c.color,c.icon,o.id);db.prepare('UPDATE movements SET category=? WHERE user_id=? AND type=? AND category=?').run(c.name,req.uid,o.kind,o.name);db.exec('COMMIT');res.json({})});
app.delete('/api/categories/:id',(req,res)=>{db.prepare('DELETE FROM categories WHERE id=? AND user_id=?').run(+req.params.id,req.uid);res.json({})});

// Prioridades: igual que las categorías (renombrar actualiza los gastos que la usan)
const prioData=b=>{const name=String(b.name||'').trim().slice(0,30);return name?{name,color:/^#[0-9a-fA-F]{6}$/.test(b.color)?b.color:'#5B4FE0',icon:cleanIcon(b.icon,'🚦')}:null};
app.post('/api/priorities',(req,res)=>{const p=prioData(req.body);if(p&&!p.icon)return err(res,400,'El ícono subido no es válido');if(!p)return err(res,400,'Poné un nombre a la prioridad');
if(db.prepare('SELECT 1 FROM priorities WHERE user_id=? AND name=?').get(req.uid,p.name))return err(res,409,'Esa prioridad ya existe');const n=db.prepare('SELECT COALESCE(MAX(sort),0)+1 n FROM priorities WHERE user_id=?').get(req.uid).n;
res.json({id:db.prepare('INSERT INTO priorities(user_id,name,color,icon,sort) VALUES(?,?,?,?,?)').run(req.uid,p.name,p.color,p.icon,n).lastInsertRowid})});
app.put('/api/priorities/:id',(req,res)=>{const o=own('priorities',+req.params.id,req.uid);if(!o)return err(res,404,'No existe esa prioridad');const p=prioData(req.body);if(p&&!p.icon)return err(res,400,'El ícono subido no es válido');if(!p)return err(res,400,'Poné un nombre a la prioridad');
if(p.name!==o.name&&db.prepare('SELECT 1 FROM priorities WHERE user_id=? AND name=?').get(req.uid,p.name))return err(res,409,'Esa prioridad ya existe');
db.exec('BEGIN');db.prepare('UPDATE priorities SET name=?,color=?,icon=? WHERE id=?').run(p.name,p.color,p.icon,o.id);db.prepare('UPDATE movements SET importance=? WHERE user_id=? AND importance=?').run(p.name,req.uid,o.name);db.exec('COMMIT');res.json({})});
app.delete('/api/priorities/:id',(req,res)=>{db.prepare('DELETE FROM priorities WHERE id=? AND user_id=?').run(+req.params.id,req.uid);res.json({})});

// Cajas: moneda principal (meta y total) + monedas habilitadas
const goalData=(b,uid)=>{const name=String(b.name||'').trim().slice(0,60),cur=+b.currency_id,cs=[...new Set([cur,...(Array.isArray(b.currencies)?b.currencies.map(Number):[])])];
return name&&cs.every(c=>own('currencies',c,uid))?{name,target:Math.max(0,+b.target||0),cur,cs:cs.join(',')}:null};
const goalBal=(uid,gid,cur,skip)=>db.prepare("SELECT COALESCE(SUM(CASE WHEN type='ahorro' AND goal_cur=? THEN COALESCE(amount2,amount) WHEN type IN ('egreso','cambio') AND goal_cur=? THEN -amount WHEN type='cambio' AND goal_cur2=? THEN amount2 WHEN type='ajuste' AND goal_cur=? THEN amount ELSE 0 END),0) t FROM movements WHERE user_id=? AND goal_id=? AND id<>?").get(cur,cur,cur,cur,uid,gid,skip||0).t;
app.post('/api/goals',(req,res)=>{const g=goalData(req.body,req.uid);if(!g)return err(res,400,'Poné un nombre y elegí la moneda');
res.json({id:db.prepare('INSERT INTO goals(user_id,name,target,currency_id,currencies) VALUES(?,?,?,?,?)').run(req.uid,g.name,g.target,g.cur,g.cs).lastInsertRowid})});
app.delete('/api/goals/:id',(req,res)=>{if(db.prepare('SELECT 1 FROM plans WHERE user_id=? AND goal_id=?').get(req.uid,req.params.id))return err(res,400,'La meta está asociada a un plan de cuotas');if(db.prepare('SELECT 1 FROM movements WHERE user_id=? AND goal_id=?').get(req.uid,req.params.id))return err(res,400,'La meta tiene aportes; borralos primero');
db.prepare('DELETE FROM goals WHERE id=? AND user_id=?').run(req.params.id,req.uid);res.json({})});
app.put('/api/goals/:id',(req,res)=>{const o=own('goals',+req.params.id,req.uid);if(!o)return err(res,404,'No existe esa caja');const g=goalData(req.body,req.uid);if(!g)return err(res,400,'Poné un nombre y elegí la moneda');
const keep=g.cs.split(',').map(Number);for(const c of goalCurs(o))if(!keep.includes(c)&&(Math.abs(goalBal(req.uid,o.id,c))>0.005||db.prepare('SELECT 1 FROM movements WHERE goal_id=? AND (goal_cur=? OR goal_cur2=?)').get(o.id,c,c)))
return err(res,400,'No podés quitar una moneda que la caja ya usó; pasá ese saldo a otra moneda y dejala habilitada');
db.prepare('UPDATE goals SET name=?,target=?,currency_id=?,currencies=? WHERE id=?').run(g.name,g.target,g.cur,g.cs,o.id);res.json({})});
app.post('/api/movements',(req,res)=>saveMv(req,res));
app.put('/api/movements/:id',(req,res)=>saveMv(req,res,+req.params.id));
function saveMv(req,res,id){const b=req.body,u=req.uid,T=b.type,a=+b.amount,cj=T==='egreso'&&b.goal_id,aj=T==='ajuste'&&b.goal_id;
if(!['ingreso','egreso','ahorro','transferencia','ajuste','cambio'].includes(T)||!/^\d{4}-\d\d-\d\d$/.test(b.date)||!isFinite(a)||a===0)return err(res,400,'Datos inválidos');
if(a<0&&T!=='ahorro'&&T!=='ajuste')return err(res,400,'El monto debe ser positivo');
const old=id?own('movements',id,u):null;if(id&&!old)return err(res,404,'No existe ese movimiento');
const other=()=>{const v=+b.amount2;return isFinite(v)&&v!==0&&Math.sign(v)===Math.sign(a)?v:NaN};let w=null,w2=null,g=null,gc=null,gc2=null,a2=null;
if(T!=='cambio'&&!cj&&!aj){w=own('wallets',+b.wallet_id,u);if(!w)return err(res,400,'Elegí una billetera')}
if(T==='transferencia'){w2=own('wallets',+b.to_wallet_id,u);if(!w2||w2.id===w.id)return err(res,400,'Elegí dos billeteras distintas');
if(w2.currency_id!==w.currency_id&&isNaN(a2=other()))return err(res,400,'Indicá cuánto recibís en la otra moneda')}
if(T==='ahorro'||cj||aj||T==='cambio'){g=own('goals',+b.goal_id,u);if(!g)return err(res,400,'Elegí una caja de ahorro');const cs=goalCurs(g);
gc=+b.goal_cur||g.currency_id;if(!cs.includes(gc))return err(res,400,'Esa moneda no está habilitada en la caja');
if(T==='ahorro'&&gc!==w.currency_id&&isNaN(a2=other()))return err(res,400,'Indicá el monto en la moneda de la caja');
if(T==='cambio'){gc2=+b.goal_cur2;if(!cs.includes(gc2)||gc2===gc)return err(res,400,'Elegí dos monedas distintas de la caja');if(isNaN(a2=other()))return err(res,400,'Indicá cuánto recibís en la otra moneda')}}
// Lo que sale de la caja (retiro o cambio de moneda) no puede dejarla en negativo en esa moneda
const out=T==='ahorro'&&a<0?-(a2??a):T==='cambio'?a:aj&&a<0?-a:0;
if(out>0&&goalBal(u,g.id,gc,id)-out<-0.005)return err(res,400,'La caja no tiene saldo suficiente en esa moneda');
const cat=String(b.category||'').trim().slice(0,40),imp=T==='egreso'?String(b.importance||'').trim().slice(0,30):'';ensureCat(u,cat,T);ensurePrio(u,imp);
const v=[b.date,T,a,a2,cat,String(b.detail||'').slice(0,120),imp,w&&w.id,w2&&w2.id,g&&g.id,gc,gc2,cj&&b.dec_target?1:0];
try{if(old)db.prepare('UPDATE movements SET date=?,type=?,amount=?,amount2=?,category=?,detail=?,importance=?,wallet_id=?,to_wallet_id=?,goal_id=?,goal_cur=?,goal_cur2=?,dec_target=? WHERE id=? AND user_id=?').run(...v,id,u);
else{const pl=b.plan_id?own('plans',+b.plan_id,u):null;
db.prepare('INSERT INTO movements(date,type,amount,amount2,category,detail,importance,wallet_id,to_wallet_id,goal_id,goal_cur,goal_cur2,dec_target,user_id,plan_id,cuota_n) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)').run(...v,u,pl?pl.id:null,pl?(+b.cuota_n||null):null)}
res.json({})}catch(e){err(res,409,'Cuota ya registrada')}}
app.post('/api/plans',(req,res)=>{const b=req.body,n=String(b.name||'').trim().slice(0,60),a=+b.amount,t=+b.total,sk=+b.skip||0,ev=+b.every||0;
if(!n||!(a>0)||!Number.isInteger(t)||t<1||t>600||!Number.isInteger(sk)||sk<0||sk>=t||!/^\d{4}-\d\d-\d\d$/.test(b.start)||!['mensual','semanal','dias'].includes(b.freq)||(b.freq==='dias'&&!(ev>=1&&ev<=365))||(!b.goal_id&&!own('wallets',+b.wallet_id,req.uid)))return err(res,400,'Revisá los datos del plan');
if(b.goal_id&&!own('goals',+b.goal_id,req.uid))return err(res,400,'Caja de ahorro inválida');
db.prepare("INSERT INTO plans(user_id,name,amount,total,skip,start,freq,every,wallet,wallet_id,goal_id,dec_target) VALUES(?,?,?,?,?,?,?,?,'',?,?,?)").run(req.uid,n,a,t,sk,b.start,b.freq,ev,b.goal_id?null:+b.wallet_id,b.goal_id?+b.goal_id:null,b.goal_id&&b.dec_target?1:0);res.json({})});
app.delete('/api/plans/:id',(req,res)=>{db.prepare('DELETE FROM plans WHERE id=? AND user_id=?').run(req.params.id,req.uid);res.json({})});
app.delete('/api/movements/:id',(req,res)=>{db.prepare('DELETE FROM movements WHERE id=? AND user_id=?').run(req.params.id,req.uid);res.json({})});
app.listen(process.env.PORT||3000,()=>console.log('FNz en puerto '+(process.env.PORT||3000)));
