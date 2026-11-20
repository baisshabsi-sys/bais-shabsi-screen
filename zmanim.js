// NOAA solar calculator ported from /workspace/zmanim/noaa_sun.py
const LAT=40.1, LON=-74.24, TZ='America/New_York';
const R=Math.PI/180;
function jd(y,m,d){if(m<=2){y--;m+=12}const A=Math.floor(y/100),B=2-A+Math.floor(A/4);return Math.floor(365.25*(y+4716))+Math.floor(30.6001*(m+1))+d+B-1524.5}
function sun(jc){const L0=((280.46646+jc*(36000.76983+jc*0.0003032))%360+360)%360,M=357.52911+jc*(35999.05029-0.0001537*jc),e=0.016708634-jc*(0.000042037+0.0000001267*jc);
const C=Math.sin(M*R)*(1.914602-jc*(0.004817+0.000014*jc))+Math.sin(2*M*R)*(0.019993-0.000101*jc)+Math.sin(3*M*R)*0.000289;
const om=125.04-1934.136*jc,lam=L0+C-0.00569-0.00478*Math.sin(om*R),eps0=23+(26+(21.448-jc*(46.815+jc*(0.00059-jc*0.001813)))/60)/60,eps=eps0+0.00256*Math.cos(om*R);
const decl=Math.asin(Math.sin(eps*R)*Math.sin(lam*R))/R,y=Math.tan(eps/2*R)**2;
const eot=4*(y*Math.sin(2*L0*R)-2*e*Math.sin(M*R)+4*e*y*Math.sin(M*R)*Math.cos(2*L0*R)-0.5*y*y*Math.sin(4*L0*R)-1.25*e*e*Math.sin(2*M*R))/R;return[decl,eot]}
function eventMs(y,m,d,rising,alt=-0.833){const J=jd(y,m,d);let t=720-4*LON;for(let i=0;i<3;i++){const[decl,eot]=sun((J+t/1440-2451545)/36525);
const c=(Math.sin(alt*R)-Math.sin(LAT*R)*Math.sin(decl*R))/(Math.cos(LAT*R)*Math.cos(decl*R));if(Math.abs(c)>1)return null;let H=Math.acos(c)/R;if(rising)H=-H;t=720-4*(LON-H)-eot}
return Date.UTC(y,m-1,d)+t*60000}
// y,m,d = civil date (Lakewood calendar date)
function zmanim(y,m,d){const rise=eventMs(y,m,d,true),set=eventMs(y,m,d,false),hr=(set-rise)/12,alos=rise-72*60000,tz=set+72*60000,hrMA=(tz-alos)/12,MIN=60000;
const z={sunrise:rise,sunset:set,shemaMA:alos+3*hrMA,shemaGra:rise+3*hr,chatzos:rise+6*hr,minchaGedolah:rise+6.5*hr,alos72:alos,misheyakir:eventMs(y,m,d,true,-11.5)};
const dow=new Date(Date.UTC(y,m-1,d)).getUTCDay();
if(dow===5){const c=set-18*MIN;z.candle=Math.floor(c/MIN)*MIN}
if(dow===6){z.motzei42=set+42*MIN;z.motzei60=set+60*MIN}
return z}
const MIN=60000;
function fmt(ms,sec){if(ms==null)return'—';return new Date(ms).toLocaleTimeString('en-US',{timeZone:TZ,hour:'numeric',minute:'2-digit',second:sec?'2-digit':undefined}).replace(/\s?[AP]M/,'')}
// minutes-of-day in Lakewood (fractional) for rounding
function lmins(ms){const p=new Intl.DateTimeFormat('en-US',{timeZone:TZ,hour:'numeric',minute:'numeric',second:'numeric',hourCycle:'h23'}).formatToParts(new Date(ms));const g=t=>+p.find(x=>x.type===t).value;return g('hour')*60+g('minute')+g('second')/60}
function round5(min,mode){if(mode==='later_5'||mode==='up')return Math.ceil(min/5-1e-9)*5;if(mode==='earlier_5'||mode==='down')return Math.floor(min/5+1e-9)*5;if(mode==='nearest_5')return Math.round(min/5)*5;return min}
function hm(min){min=Math.round(min);let h=Math.floor(min/60)%24,mm=min%60;const h12=((h+11)%12)+1;return h12+':'+String(mm).padStart(2,'0')}
// today's Lakewood civil date
function todayYMD(now=new Date()){const s=now.toLocaleDateString('en-CA',{timeZone:TZ});const[y,m,d]=s.split('-').map(Number);return{y,m,d}}
function addDays({y,m,d},n){const t=new Date(Date.UTC(y,m-1,d+n));return{y:t.getUTCFullYear(),m:t.getUTCMonth()+1,d:t.getUTCDate()}}

// Daf Yomi (Bavli), cycle of 2711 days; cycle 14 began 2020-01-05 (Berachos 2). Input: local y,m,d.
const DAF_M=[['ברכות',64],['שבת',157],['עירובין',105],['פסחים',121],['שקלים',22],['יומא',88],['סוכה',56],['ביצה',40],['ראש השנה',35],['תענית',31],['מגילה',32],['מועד קטן',29],['חגיגה',27],['יבמות',122],['כתובות',112],['נדרים',91],['נזיר',66],['סוטה',49],['גיטין',90],['קידושין',82],['בבא קמא',119],['בבא מציעא',119],['בבא בתרא',176],['סנהדרין',113],['מכות',24],['שבועות',49],['עבודה זרה',76],['הוריות',14],['זבחים',120],['מנחות',110],['חולין',142],['בכורות',61],['ערכין',34],['תמורה',34],['כריתות',28],['מעילה',22],['קינים',3],['תמיד',8],['מדות',4],['נדה',73]];
const DAF_OFF={'קינים':23,'תמיד':26,'מדות':34};// first daf of each (no -1 adjustment)
function hebNum(n){const o=['','א','ב','ג','ד','ה','ו','ז','ח','ט'],t=['','י','כ','ל','מ','נ','ס','ע','פ','צ'],h=['','ק','ר','ש','ת'];let s='';if(n>=100){s+=h[Math.floor(n/100)];n%=100}if(n===15)s+='טו';else if(n===16)s+='טז';else s+=t[Math.floor(n/10)]+o[n%10];return s.length>1?s.slice(0,-1)+'״'+s.slice(-1):s+'׳'}
function dafYomi(y,m,d){const days=Math.round((Date.UTC(y,m-1,d)-Date.UTC(2020,0,5))/864e5);let i=((days%2711)+2711)%2711;for(const[n,c0]of DAF_M){const c=DAF_OFF[n]!=null?c0:c0-1;if(i<c){const daf=DAF_OFF[n]!=null?i+DAF_OFF[n]:i+2;return{name:n,daf,text:n+' '+hebNum(daf)}}i-=c}}
