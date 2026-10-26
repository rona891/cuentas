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
const SET={lang:['es','en'],theme:['claro','oscuro','medianoche','crema']},getSet=uid=>{try{return JSON.parse(db.prepare('SELECT settings FROM users WHERE id=?').get(uid).settings||'{}')}catch{return{}}};
const app=express();app.set('trust proxy',1);app.use(express.json(),cp());app.use(express.static('public'));
const err=(res,c,m)=>res.status(c).json({error:m});
const login=(res,u)=>res.cookie('tk',jwt.sign({uid:u.id},SECRET,{expiresIn:'30d'}),{httpOnly:true,sameSite:'lax',secure:process.env.COOKIE_SECURE==='1',maxAge:30*864e5}).json({username:u.username});
const tries={};const limit=(req,res,next)=>{const k=req.ip,t=Date.now();tries[k]=(tries[k]||[]).filter(x=>t-x<9e5);if(tries[k].length>=10)return err(res,429,'Demasiados intentos, esperá unos minutos');tries[k].push(t);next()};
app.post('/api/register',limit,(req,res)=>{if(process.env.ALLOW_REGISTER==='0')return err(res,403,'Registro deshabilitado');
const{username,password}=req.body;if(!/^[\w.-]{3,30}$/.test(username||'')||(password||'').length<8)return err(res,400,'Usuario (3-30 caracteres) y contraseña (mín. 8)');
try{const r=db.prepare('INSERT INTO users(username,hash) VALUES(?,?)').run(username.toLowerCase(),bcrypt.hashSync(password,10));login(res,{id:r.lastInsertRowid,username})}catch{err(res,409,'Ese usuario ya existe')}});
app.post('/api/login',limit,(req,res)=>{const u=db.prepare('SELECT * FROM users WHERE username=?').get(String(req.body.username||'').toLowerCase());
if(!u||!bcrypt.compareSync(String(req.body.password||''),u.hash))return err(res,401,'Usuario o contraseña incorrectos');login(res,u)});
app.post('/api/logout',(q,res)=>res.clearCookie('tk').json({}));
app.use('/api',(req,res,next)=>{try{const p=jwt.verify(req.cookies.tk,SECRET);req.uid=p.uid;next()}catch{err(res,401,'No autenticado')}});
app.get('/api/me',(req,res)=>res.json(db.prepare('SELECT username FROM users WHERE id=?').get(req.uid)));
app.put('/api/settings',(req,res)=>{const s=getSet(req.uid);for(const[k,v]of Object.entries(req.body||{}))if(SET[k]&&SET[k].includes(v))s[k]=v;
db.prepare('UPDATE users SET settings=? WHERE id=?').run(JSON.stringify(s),req.uid);res.json(s)});
const checkPw=(req,res)=>{const u=db.prepare('SELECT * FROM users WHERE id=?').get(req.uid);if(!u||!bcrypt.compareSync(String(req.body.password||''),u.hash)){err(res,401,'La contraseña actual no es correcta');return null}return u};
app.put('/api/account',limit,(req,res)=>{const u=checkPw(req,res);if(!u)return;const b=req.body;
if(b.username!==undefined){const n=String(b.username).toLowerCase();if(!/^[\w.-]{3,30}$/.test(n))return err(res,400,'El usuario debe tener entre 3 y 30 caracteres (letras, números, punto, guion)');
try{db.prepare('UPDATE users SET username=? WHERE id=?').run(n,u.id)}catch{return err(res,409,'Ese usuario ya existe')}}
if(b.new_password!==undefined){if(String(b.new_password).length<8)return err(res,400,'La contraseña nueva debe tener al menos 8 caracteres');db.prepare('UPDATE users SET hash=? WHERE id=?').run(bcrypt.hashSync(String(b.new_password),10),u.id)}
res.json(db.prepare('SELECT username FROM users WHERE id=?').get(u.id))});
// Formatear: borra lo que el usuario elija. Borrar cajas arrastra sus movimientos y los planes que se pagan con ellas.
app.post('/api/reset',limit,(req,res)=>{const u=checkPw(req,res);if(!u)return;const w=new Set(Array.isArray(req.body.what)?req.body.what:[]),q=s=>db.prepare(s).run(u.id);
if(!w.size)return err(res,400,'Elegí qué querés borrar');db.exec('BEGIN');try{
if(w.has('movimientos'))q('DELETE FROM movements WHERE user_id=?');
if(w.has('cuotas'))q('DELETE FROM plans WHERE user_id=?');
if(w.has('cajas')){q('DELETE FROM movements WHERE user_id=? AND goal_id IS NOT NULL');q('DELETE FROM plans WHERE user_id=? AND goal_id IS NOT NULL');q('DELETE FROM goals WHERE user_id=?')}
if(w.has('configuracion'))q("UPDATE users SET settings='{}' WHERE id=?");
db.exec('COMMIT')}catch(e){db.exec('ROLLBACK');return err(res,500,'No se pudo formatear')}res.json({})});
app.get('/api/data',(req,res)=>res.json({username:db.prepare('SELECT username FROM users WHERE id=?').get(req.uid).username,settings:getSet(req.uid),movs:db.prepare('SELECT * FROM movements WHERE user_id=? ORDER BY date DESC,id DESC').all(req.uid),goals:db.prepare('SELECT * FROM goals WHERE user_id=?').all(req.uid),plans:db.prepare('SELECT * FROM plans WHERE user_id=?').all(req.uid)}));
app.post('/api/goals',(req,res)=>{const n=String(req.body.name||'').trim().slice(0,60);if(!n)return err(res,400,'Falta el nombre');
db.prepare('INSERT INTO goals(user_id,name,target) VALUES(?,?,?)').run(req.uid,n,Math.max(0,+req.body.target||0));res.json({})});
app.delete('/api/goals/:id',(req,res)=>{if(db.prepare('SELECT 1 FROM plans WHERE user_id=? AND goal_id=?').get(req.uid,req.params.id))return err(res,400,'La meta está asociada a un plan de cuotas');if(db.prepare('SELECT 1 FROM movements WHERE user_id=? AND goal_id=?').get(req.uid,req.params.id))return err(res,400,'La meta tiene aportes; borralos primero');
db.prepare('DELETE FROM goals WHERE id=? AND user_id=?').run(req.params.id,req.uid);res.json({})});
app.put('/api/goals/:id',(req,res)=>{const n=String(req.body.name||'').trim().slice(0,60);if(!n)return err(res,400,'Falta el nombre');
const r=db.prepare('UPDATE goals SET name=?,target=? WHERE id=? AND user_id=?').run(n,Math.max(0,+req.body.target||0),req.params.id,req.uid);r.changes?res.json({}):err(res,404,'No existe esa caja')});
const goalBal=(uid,gid,skip)=>db.prepare("SELECT COALESCE(SUM(CASE WHEN type='ahorro' THEN amount WHEN type='egreso' THEN -amount ELSE 0 END),0) t FROM movements WHERE user_id=? AND goal_id=? AND id<>?").get(uid,gid,skip||0).t;
app.post('/api/movements',(req,res)=>saveMv(req,res));
app.put('/api/movements/:id',(req,res)=>saveMv(req,res,+req.params.id));
function saveMv(req,res,id){const b=req.body,a=+b.amount,W=['efectivo','virtual'],cj=b.type==='egreso'&&b.goal_id;
if(!['ingreso','egreso','ahorro','transferencia','ajuste'].includes(b.type)||!/^\d{4}-\d\d-\d\d$/.test(b.date)||!isFinite(a)||a===0||(!cj&&!W.includes(b.wallet)))return err(res,400,'Datos inválidos');
if(b.type==='transferencia'&&(!W.includes(b.to_wallet)||b.to_wallet===b.wallet))return err(res,400,'Elegí dos billeteras distintas');
if(a<0&&b.type!=='ahorro'&&b.type!=='ajuste')return err(res,400,'El monto debe ser positivo');
let g=null;if(b.type==='ahorro'||cj){g=db.prepare('SELECT id FROM goals WHERE id=? AND user_id=?').get(b.goal_id,req.uid);if(!g)return err(res,400,'Elegí una caja de ahorro');}
const old=id?db.prepare('SELECT * FROM movements WHERE id=? AND user_id=?').get(id,req.uid):null;if(id&&!old)return err(res,404,'No existe ese movimiento');
if(b.type==='ahorro'&&a<0){const t=goalBal(req.uid,g.id,id);if(t+a<-0.005)return err(res,400,'La caja tiene $'+Math.round(t).toLocaleString('es-AR')+', no podés retirar más que eso')}
const v=[b.date,b.type,a,String(b.category||'').slice(0,40),String(b.detail||'').slice(0,120),String(b.importance||'').slice(0,20),cj?'':b.wallet,b.type==='transferencia'?b.to_wallet:'',g&&g.id,cj&&b.dec_target?1:0];
try{if(old)db.prepare('UPDATE movements SET date=?,type=?,amount=?,category=?,detail=?,importance=?,wallet=?,to_wallet=?,goal_id=?,dec_target=? WHERE id=? AND user_id=?').run(...v,id,req.uid);
else{const pl=b.plan_id?db.prepare('SELECT id FROM plans WHERE id=? AND user_id=?').get(b.plan_id,req.uid):null;
db.prepare('INSERT INTO movements(date,type,amount,category,detail,importance,wallet,to_wallet,goal_id,dec_target,user_id,plan_id,cuota_n) VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)').run(...v,req.uid,pl?pl.id:null,pl?(+b.cuota_n||null):null)}
res.json({})}catch(e){err(res,409,'Cuota ya registrada')}}
app.post('/api/plans',(req,res)=>{const b=req.body,W=['efectivo','virtual'],n=String(b.name||'').trim().slice(0,60),a=+b.amount,t=+b.total,sk=+b.skip||0,ev=+b.every||0;
if(!n||!(a>0)||!Number.isInteger(t)||t<1||t>600||!Number.isInteger(sk)||sk<0||sk>=t||!/^\d{4}-\d\d-\d\d$/.test(b.start)||!['mensual','semanal','dias'].includes(b.freq)||(b.freq==='dias'&&!(ev>=1&&ev<=365))||(!b.goal_id&&!W.includes(b.wallet)))return err(res,400,'Revisá los datos del plan');
if(b.goal_id&&!db.prepare('SELECT 1 FROM goals WHERE id=? AND user_id=?').get(b.goal_id,req.uid))return err(res,400,'Caja de ahorro inválida');
db.prepare('INSERT INTO plans(user_id,name,amount,total,skip,start,freq,every,wallet,goal_id,dec_target) VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(req.uid,n,a,t,sk,b.start,b.freq,ev,b.goal_id?'':b.wallet,b.goal_id?+b.goal_id:null,b.goal_id&&b.dec_target?1:0);res.json({})});
app.delete('/api/plans/:id',(req,res)=>{db.prepare('DELETE FROM plans WHERE id=? AND user_id=?').run(req.params.id,req.uid);res.json({})});
app.delete('/api/movements/:id',(req,res)=>{db.prepare('DELETE FROM movements WHERE id=? AND user_id=?').run(req.params.id,req.uid);res.json({})});
app.listen(process.env.PORT||3000,()=>console.log('Cuentas en puerto '+(process.env.PORT||3000)));
