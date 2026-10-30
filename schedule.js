// Builds the weekly davening schedule from GoDaven data + shul rules.
const DAYKEYS=['sun','mon','tues','wed','thurs','fri','sat'];
function inSeason(mny,{m,d}){if(!mny.start_date||!mny.end_date)return true;
 const [,sm,sd]=mny.start_date.split('-').map(Number),[,em,ed]=mny.end_date.split('-').map(Number);
 const v=m*100+d,s=sm*100+sd,e=em*100+ed;return s<=e?(v>=s&&v<=e):(v>=s||v<=e)}// recurs yearly, wraps over new year
function fixedMin(t){const[h,mm]=t.split(':').map(Number);return h*60+mm}
function buildSchedule(api,today){
 const g=api.groupedByDayMinyanim, dow=new Date(Date.UTC(today.y,today.m-1,today.d)).getUTCDay();
 const sunday=addDays(today,-dow), week=[...Array(7)].map((_,i)=>addDays(sunday,i));
 const Z=week.map(w=>zmanim(w.y,w.m,w.d));
 // Shul rules (weekly, Sun-Thu)
 const maxShkia=Math.max(...Z.slice(0,5).map(z=>lmins(z.sunset)));
 const lateMincha=round5(maxShkia-20,'up'), earlyMaariv=round5(maxShkia,'up');
 const candleMin=lmins(Z[5].candle), sat=Z[6];
 const notes=[];
 function clampG(mny,v){if(v==null)return v;if(mny.not_earlier_than)v=Math.max(v,fixedMin(mny.not_earlier_than));if(mny.not_later_than)v=Math.min(v,fixedMin(mny.not_later_than));return v}// GoDaven not_earlier_than / not_later_than
 function val(mny,dayIdx){return clampG(mny,val0(mny,dayIdx))}
 function val0(mny,dayIdx){
  if(mny.time_at)return fixedMin(mny.time_at);
  const zt=mny.zman_type&&mny.zman_type.name;
  if(dayIdx<5&&zt==='shkiah'&&mny.offset_minutes===-20)return lateMincha;
  if(dayIdx<5&&zt==='shkiah'&&mny.offset_minutes===0)return earlyMaariv;
  if(dayIdx<5&&zt==='shkiah'&&mny.offset_calculated_by==='latest_of_week')return round5(maxShkia+mny.offset_minutes,mny.offset_rounded_by);// e.g. 30513 shkiah+35 latest of week, capped 8:45-9:05
  if(dayIdx<5&&mny.displayTime)return fixedMin(mny.displayTime);// GoDaven's own value (e.g. 30513 shows 8:45 though tagged shkiah+35)
  if(zt==='shkiah'||zt==='candle_lighting'){const base=zt==='shkiah'?lmins(Z[dayIdx].sunset):candleMin;return round5(base+mny.offset_minutes,mny.offset_rounded_by)}
  // e.g. mincha_gedolah / unusual entries: trust GoDaven's computed displayTime
  if(mny.displayTime)return fixedMin(mny.displayTime);return null}
 // Weekday table: union of Sun-Thu (Sun shown separately for Shacharis)
 const wk={shachrisSun:[],shachris:[],mincha:[],mariv:[]};
 const add=(arr,v)=>{if(v!=null&&!arr.includes(v))arr.push(v)};
 for(let i=0;i<5;i++){const k=DAYKEYS[i],day=g[k]||{};
  for(const t of['shachris','mincha','mariv'])for(const mny of(day[t]||[])){if(!inSeason(mny,week[i]))continue;const v=val(mny,i);
   add(t==='shachris'?(i===0?wk.shachrisSun:wk.shachris):wk[t],v)}}
 for(const mny of(g.fri?.shachris||[]))add(wk.shachris,val(mny,5));
 Object.values(wk).forEach(a=>a.sort((a,b)=>a-b));
 // Fixed 30513 sanity check: GoDaven says shkiah+35 but displays a fixed-looking 8:45
 const shab={candle:Z[5].candle, friMincha:candleMin+3,
  // Shul rule (BZ 0006): Shabbos Shacharis 8:30, or sof zman Shema GRA -45 rounded down to :05 if earlier
  shachris:(()=>{const r=Math.min(510,round5(Math.floor(lmins(sat.shemaGra))-45,'down'));const a=(g.sat?.shachris||[]).map(m=>val(m,6)).map(v=>v===510?r:v);return a.length?a:[r]})(),
  minchaGedolah:(g.sat?.mincha||[]).filter(m=>m.zman_type?.name==='mincha_gedolah').map(m=>val(m,6))[0],
  lateMincha:Math.min(round5(candleMin-30,'nearest_5'),19*60),// regular Shabbos late Mincha never after 7:00 (GoDaven 30515)
  early:earlyShabbos(week[5],Z[5]), motzei42:sat.motzei42, motzei60:sat.motzei60};
 return{week,Z,wk,shab,maxShkia,lateMincha,earlyMaariv}}
// Early Shabbos (BZ 0002): Friday minyan at plag GRA +10, up to :05; from first Friday after Pesach until it computes before 6:00 PM; not Erev YT / YT
function pesachDate(Y){// 15 Nisan (Gauss), Gregorian
 const a=(12*Y+12)%19,b=Y%4,Q=20.0955877+1.5542418*a+0.25*b-0.003177794*Y;let M=Math.floor(Q);const m=Q-M,c=(M+3*Y+5*b+1)%7;
 if(c===2||c===4||c===6)M+=1;else if(c===1&&a>6&&m>=1367/2160)M+=2;else if(c===0&&a>11&&m>=23269/25920)M+=1;
 return new Date(Date.UTC(Y,2,M+Math.floor(Y/100)-Math.floor(Y/400)-2))}
function earlyMin(f,z){const r=lmins(z.sunrise),st=lmins(z.sunset);return round5(r+10.75*(st-r)/12+10,'up')}
function earlyShabbos(fri,zf){const D=x=>Date.UTC(x.y,x.m-1,x.d),day=86400000,P=pesachDate(fri.y).getTime(),f=D(fri);
 const skip=[P+49*day,P+50*day,P+51*day,P+162*day];// Erev Shavuos / Shavuos / Erev RH Fridays
 let t=P+7*day+((5-new Date(P+7*day).getUTCDay()+7)%7||7)*day;// first Friday after 8th day
 for(;t<=f;t+=7*day){const d=new Date(t),zz=zmanim(d.getUTCFullYear(),d.getUTCMonth()+1,d.getUTCDate());const v=earlyMin(null,zz);
  if(v<18*60)return null;if(t===f)return skip.includes(t)?null:(t===P+48*day?19*60+5:v)}// Shabbos is Erev Shavuos: fixed 7:05
 return null}
if(typeof module!=='undefined')module.exports={buildSchedule,inSeason};
