// ---- Background classical music (weekdays only). Off switch: MUSIC_ENABLED=false, or ?music=0 in the URL.
const MUSIC_ENABLED = false;
const STREAM_URL='https://stream.wqxr.org/wqxr-web';// WQXR 105.9 New York classical (MP3)
const API='https://www.godaven.com/api/V2/shuls/4458/details';
const HEB_DAYS=['ראשון','שני','שלישי','רביעי','חמישי','ערב שבת קודש','שבת קודש'];
let state={api:null,heb:null,shabbat:null,lastDay:null};
const $=id=>document.getElementById(id);
function load(k){try{return JSON.parse(localStorage.getItem(k))}catch(e){return null}}
function save(k,v){try{localStorage.setItem(k,JSON.stringify(v))}catch(e){}}
async function getJSON(url){const r=await fetch(url,{cache:'no-store'});if(!r.ok)throw new Error(r.status);return r.json()}
// ?now=2026-10-16T16:00 lets you preview another moment (testing / screenshots)
const P=new URLSearchParams(location.search);
const offset=P.get('now')?(new Date(P.get('now')+'-04:00')-Date.now()):0;
const now=()=>new Date(Date.now()+offset);
async function refreshData(){
 const t=todayYMD(now()),ds=`${t.y}-${String(t.m).padStart(2,'0')}-${String(t.d).padStart(2,'0')}`;
 try{state.api=await getJSON(API);save('godaven',state.api);$('status').textContent=''}
 catch(e){try{state.api=await getJSON('data/godaven.json')}catch(_){state.api=load('godaven')}$('status').textContent='offline – cached data'}
 try{state.heb=await getJSON(`https://www.hebcal.com/converter?cfg=json&date=${ds}&g2h=1&strict=1`);save('heb',state.heb)}catch(e){state.heb=load('heb')}
 try{state.shabbat=await getJSON(`https://www.hebcal.com/shabbat?cfg=json&geo=pos&latitude=40.1&longitude=-74.24&tzid=America/New_York&M=on&b=18&gy=${t.y}&gm=${t.m}&gd=${t.d}`);save('shabbat',state.shabbat)}catch(e){state.shabbat=load('shabbat')}
 render()}
function wkParsha(d){const ds=`${d.y}-${String(d.m).padStart(2,'0')}-${String(d.d).padStart(2,'0')}`,el=$('wkparsha');
 const show=h=>{el.textContent=h?'של פרשת '+h.replace(/^פרשת\s*/,''):''};
 if(state.wkpDate===ds){show(state.wkp);return}state.wkpDate=ds;state.wkp=load('wkp:'+ds);show(state.wkp);
 getJSON(`https://www.hebcal.com/shabbat?cfg=json&geo=pos&latitude=40.1&longitude=-74.24&tzid=America/New_York&M=on&b=18&gy=${d.y}&gm=${d.m}&gd=${d.d}`).then(j=>{const p=j.items.find(i=>i.category==='parashat');state.wkp=p?p.hebrew:'';save('wkp:'+ds,state.wkp);show(state.wkp);render()}).catch(()=>{})}
function hebMD(d){const f=new Intl.DateTimeFormat('en-u-ca-hebrew',{month:'long',day:'numeric',timeZone:'UTC'}).formatToParts(new Date(Date.UTC(d.y,d.m-1,d.d)));return{m:f.find(x=>x.type==='month').value,d:+f.find(x=>x.type==='day').value}}
function bhbOn(d,n){// first Shabbos of Cheshvan/Iyar = S; BHB = S+2, S+5, S+9
 for(let k=0;k<=10;k++){const s=addDays(d,-k);if(new Date(Date.UTC(s.y,s.m-1,s.d)).getUTCDay()!==6)continue;const h=hebMD(s);
  if(!/^(Heshvan|Cheshvan|Iyar)$/.test(h.m)||h.d>7)continue;const last=addDays(s,9),ld=Date.UTC(last.y,last.m-1,last.d),dd=Date.UTC(d.y,d.m-1,d.d);
  if(dd<ld)return true;if(dd===ld){const now=lmins(n.getTime()),td=todayYMD(n);return !(td.y===last.y&&td.m===last.m&&td.d===last.d&&now>=9*60)}}
 return false}
function row(label,val,cls=''){return `<tr class="${cls}"><th>${label}</th><td>${val}</td></tr>`}

/* Mazel Tov stage ticker — red full-width bar above the clock.
   Standing schedule whenever a banner is requested:
   start Fri 2:00 PM America/New_York, end Motzei R"T (sunset+72 / shSw).
   Clear STAGE_BAN.text (or dates) to hide. */
const STAGE_BAN={
 text:'Mazel Tov to the Berkovicz - Steinharter families upon the marriage of their children  ·  Mazel Tov to the Sofer family upon the birth of their first grandchild  ·  שלום זכר at 241 Metedeconk Trl, Jackson  ·  ',
 // Inclusive civil dates (local) for this run
 from:{y:2026,m:10,d:30}, // Friday
 to:{y:2026,m:10,d:31},   // Motzei Shabbos night still Oct 31 until midnight
 startFriHour:14, // 2pm Friday
 px:90
};
let stageBan={on:false,x:0,w:0,last:0,raf:0};
function ymdOnOrAfter(a,b){return a.y>b.y||(a.y===b.y&&(a.m>b.m||(a.m===b.m&&a.d>=b.d)))}
function ymdOnOrBefore(a,b){return a.y<b.y||(a.y===b.y&&(a.m<b.m||(a.m===b.m&&a.d<=b.d)))}
function stageBanShouldShow(n,t,dow,shSw){
 if(!STAGE_BAN.text)return false;
 if(!ymdOnOrAfter(t,STAGE_BAN.from)||!ymdOnOrBefore(t,STAGE_BAN.to))return false;
 if(shSw)return false; // Motzei R"T — Shabbos panel flipped
 if(dow===5){ // Friday: only from 2pm
  const mins=n.getHours()*60+n.getMinutes();
  return mins>=STAGE_BAN.startFriHour*60;
 }
 if(dow===6)return true; // all day Shabbos until Motzei R"T
 return false;
}
function setStageBan(on){
 const ban=$('stageban'); if(!ban)return;
 if(on===stageBan.on){ if(on&&!stageBan.raf)stageBan.raf=requestAnimationFrame(tickStageBan); return; }
 stageBan.on=!!on;
 ban.querySelectorAll('.stagebanmsg').forEach(el=>{el.textContent=STAGE_BAN.text||''});
 ban.classList.toggle('on',stageBan.on); ban.setAttribute('aria-hidden',stageBan.on?'false':'true');
 stageBan.x=0; stageBan.w=0; stageBan.last=0;
 const track=ban.querySelector('.stageban-track'); if(track)track.style.transform='translateY(-50%) translateX(0px)';
 if(stageBan.on)stageBan.raf=requestAnimationFrame(tickStageBan);
}
function tickStageBan(now){
 stageBan.raf=0; const ban=$('stageban'),track=ban&&ban.querySelector('.stageban-track');
 if(!stageBan.on||!track)return;
 const c=ban.querySelector('.stageban-cycle'); const w=c?c.offsetWidth:0; if(w>0)stageBan.w=w;
 if(!stageBan.w){stageBan.last=now;stageBan.raf=requestAnimationFrame(tickStageBan);return}
 const dt=Math.min(64,now-(stageBan.last||now)); stageBan.last=now;
 stageBan.x-=STAGE_BAN.px*(dt/1000);
 while(stageBan.x<=-stageBan.w)stageBan.x+=stageBan.w;
 if(stageBan.x>0)stageBan.x=0;
 track.style.transform='translateY(-50%) translateX('+stageBan.x.toFixed(2)+'px)';
 stageBan.raf=requestAnimationFrame(tickStageBan);
}

function render(){
 if(!state.api)return;
 const n=now(),t=todayYMD(n),dow=new Date(Date.UTC(t.y,t.m-1,t.d)).getUTCDay();state.lastDay=t.d;
 const S=buildSchedule(state.api,t),Z=zmanim(t.y,t.m,t.d),sh=S.shab;
 // Shabbos panel flips to next week after Motzei R"T (sunset+72). Weekday panel switches 5 min before earlier Motzei Maariv.
 const wkSw=sh.motzei42!=null?sh.motzei42-5*60000:sh.motzei60,shSw=dow===6&&Z.sunset!=null&&n.getTime()>Z.sunset+72*60000;
 const wkT=(dow===6&&wkSw!=null&&n.getTime()>=wkSw)?addDays(t,1):t,S2=wkT===t?S:buildSchedule(state.api,wkT),W=S2.wk,shD=shSw?S2.shab:sh;state.switched=shSw;
 setStageBan(stageBanShouldShow(n,t,dow,shSw));


 // Gold שבת mode: Fri after the 1:45 weekday Mincha (not chatzos); Sat until Motzei R"T
 const fri145=(W.mincha||[]).find(v=>v!=null&&v<900);
 const shabMode=(dow===5&&fri145!=null&&lmins(n.getTime())>fri145)||(dow===6&&!shSw);
 document.body.classList.toggle('shabbos',shabMode);
 wkParsha(wkT);
 
 // Fri candle lighting -> later Motzei Shabbos Maariv: show the Shabbos graphic in place of the weekday panel
 document.body.classList.toggle('candles',sh.candle!=null&&n.getTime()>=sh.candle&&n.getTime()<=sh.candle+90*60000);
 state.shabQuiet=sh.candle!=null&&sh.motzei60!=null&&n.getTime()>=sh.candle&&n.getTime()<=sh.motzei60;// music: silent candle lighting .. later Motzei Maariv
 document.body.classList.toggle('graphic',sh.candle!=null&&sh.motzei60!=null&&n.getTime()>=sh.candle&&n.getTime()<wkSw);

 {const dy=dafYomi(t.y,t.m,t.d);$('dafyomi').textContent='דף יומי: '+dy.text}
 $('engdate').textContent=n.toLocaleDateString('en-US',{timeZone:TZ,weekday:'long',month:'long',day:'numeric',year:'numeric'});
 $('hebdate').textContent=state.heb?state.heb.hebrew:'';
 const par=state.shabbat&&state.shabbat.items.find(i=>i.category==='parashat');
 $('parsha').textContent=par?(par.hebrew):'';
 const st=$('shabtitle');const parH=state.switched?(state.wkp?state.wkp:''):(par?par.hebrew:'');st.textContent=parH?'שבת '+parH:'שבת קודש';st.style.fontSize='';
 for(let fs=50;st.scrollWidth>st.clientWidth&&fs>30;fs-=2)st.style.fontSize=fs+'px';// keep on one line
 $('dayname').textContent=(dow>=5?'':'יום ')+HEB_DAYS[dow];
 const nowMin=lmins(n.getTime()),M=ms=>ms==null?null:lmins(ms);
 // Today's minyanim, by key -> minutes. Weekday keys "row:i", Shabbos-panel keys "s:name".
 const ev=[],add=(key,min,group)=>{if(min!=null)ev.push({key,min,group})};
 const rows={sun:W.shachrisSun,wk:W.shachris,mincha:W.mincha,mariv:W.mariv};
 const RG={sun:'shachris',wk:'shachris',mincha:'mincha',mariv:'mariv'};const addRow=r=>rows[r].forEach((v,i)=>add(r+':'+i,v,RG[r]));
 if(dow===0)addRow('sun');if(dow>=1&&dow<=5)addRow('wk');if(dow<=4){addRow('mincha');addRow('mariv')}
 if(dow===5)add('s:friMincha',sh.friMincha,'friMincha');if(dow===5&&sh.early!=null)add('s:early',sh.early,'friMincha');// candle lighting never fades
 if(dow===6){sh.shachris.forEach((v,i)=>add('s:shachris'+i,v,'shachris'));add('s:mg',sh.minchaGedolah,'mincha');add('s:late',sh.lateMincha,'mincha');add('s:m42',M(sh.motzei42),'mariv');add('s:m60',M(sh.motzei60),'mariv')}
 // fade passed times only within the tefillah in progress (the group holding the next minyan)
 const nxt=ev.filter(e=>e.min>=nowMin).sort((a,b)=>a.min-b.min)[0];
 const mark={};ev.forEach(e=>{if(nxt&&e.group===nxt.group&&e.min<nowMin)mark[e.key]='past'});
 // Friday: weekday Mincha row — the early (1:45) Mincha fades once passed; later weekday Minchas (3:30, late) don't happen Fridays, so always faded, never 'next'
 if(dow===5)W.mincha.forEach((v,i)=>{if(v==null)return;if(v>=900||v<nowMin)mark['mincha:'+i]='past'});
 state.nextMin=nxt?nxt.min:null;
 if(nxt)mark[nxt.key]='next';
 else mark[dow===5?'s:shachris0':dow===6?'sun:0':'wk:0']='next';// after the last minyan: tomorrow's first
 const cls=k=>mark[k]?' '+mark[k]:'';
 // Captions keyed to GoDaven minyan ids
 const CAPTIONS={41557:'עזרת רחל לאה'},capAt={};
 for(const d of Object.values(state.api.groupedByDayMinyanim||{}))for(const [t,l] of Object.entries(d||{}))for(const m of l||[]){if(CAPTIONS[m.id]){const tm=m.time_at||m.displayTime;if(tm)capAt[t+':'+fixedMin(tm)]=CAPTIONS[m.id]}}
 const RT={sun:'shachris',wk:'shachris',mincha:'mincha',mariv:'mariv'};
 // BHB Selichos note: shown from the Sunday before through Shacharis (9:00) on the last BHB Monday, every Cheshvan and Iyar
 const selOn=bhbOn(wkT,n);
 const wrow=(lbl,r)=>{const arr=rows[r];return `<div class="lbl">${lbl}</div>`+[0,1,2,3,4].map(i=>{const c=cls(r+':'+i),dc=mark[r+':'+i]==='past'?' past':'';
   return (i?`<div class="dot${dc}">${arr[i]!=null?'·':''}</div>`:'')+`<div class="cell t${c}">${arr[i]!=null&&capAt[RT[r]+':'+arr[i]]?`<span class="cap">${capAt[RT[r]+':'+arr[i]]}</span>`:''}${arr[i]!=null?hm(arr[i])+(selOn&&r==='wk'&&arr[i]===420?'<span class="star">*</span>':''):(selOn&&r==='wk'&&i===arr.filter(x=>x!=null).length?'<span class="note">* סליחות בה"ב בעזרת רחל לאה</span>':'')}</div>`}).join('')};
 $('weekday').innerHTML=wrow('שחרית<small>יום ראשון</small>','sun')+wrow('שחרית<small>ב׳–ו׳</small>','wk')+wrow('מנחה','mincha')+wrow('מעריב','mariv');
 const kv=(k,v1,c='')=>`<div class="k${c}">${k}</div><div class="v t${c}">${v1}</div>`;
 $('shabbos').innerHTML=kv('הדלקת נרות',fmt(shD.candle),cls('s:candle'))+(shD.early!=null?kv('שבת מוקדם',hm(shD.early),cls('s:early')):'')+kv('מנחה ערב שבת',hm(shD.friMincha),cls('s:friMincha'))+shD.shachris.map((v,i)=>kv('שחרית',hm(v),cls('s:shachris'+i))).join('')+kv('מנחה א\'',hm(shD.minchaGedolah),cls('s:mg'))+kv('מנחה ב\'',hm(shD.lateMincha),cls('s:late'))+kv('מעריב מוצש"ק א\'',fmt(shD.motzei42),cls('s:m42'))+kv('מעריב מוצש"ק ב\'',fmt(shD.motzei60),cls('s:m60'));
 {const zr=[['עלות השחר',Z.alos72],['טלית ותפילין',Z.misheyakir],['הנץ החמה',Z.sunrise],['סו״ז ק״ש מג״א',Z.shemaMA],['סו״ז ק״ש גר״א',Z.shemaGra],['חצות היום',Z.chatzos],['מנחה גדולה',Z.minchaGedolah],['שקיעת החמה',Z.sunset]];const zm=zr.map(r=>M(r[1]));const zn=zm.findIndex(m=>m!=null&&m>=nowMin);$('zmanim').innerHTML=zr.map((r,i)=>kv(r[0],fmt(r[1]),i===zn?' next':'')).join('');}
}
function tick(){const n=now();$('clock').textContent=n.toLocaleTimeString('en-US',{timeZone:TZ,hour:'numeric',minute:'2-digit',second:'2-digit'}).replace(/\s?[AP]M/,'');
 if(state.api&&todayYMD(n).d!==state.lastDay)refreshData();}// midnight rollover
state.api=load('godaven');state.heb=load('heb');state.shabbat=load('shabbat');
render();refreshData();setInterval(tick,1000);setInterval(refreshData,3600e3);setInterval(render,60e3);tick();

// Version check: deploy.sh publishes version.txt. Hourly, reload ONLY if it changed.
// Fetch failure (offline) = do nothing. Postponed if within 2 min of the next minyan.
let loadedVersion=null;
async function fetchVersion(){try{const r=await fetch('version.txt?t='+Date.now(),{cache:'no-store'});return r.ok?(await r.text()).trim():null}catch(e){return null}}
async function checkVersion(){
 const v=await fetchVersion();if(!v)return;
 if(loadedVersion===null){loadedVersion=v;return}
 if(v===loadedVersion)return;
 if(state.nextMin!=null){const d=state.nextMin-lmins(now().getTime());if(d>=-2&&d<=2){setTimeout(checkVersion,5*60e3);return}}
 location.reload();
}
fetchVersion().then(v=>{if(v)loadedVersion=v});
setInterval(checkVersion,3600e3);
