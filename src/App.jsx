import { useState, useEffect, useRef } from "react";

const XP_THRESHOLDS = [0,10000,25000,50000,90000,150000,250000,400000,650000,1000000];
const STAT_TITLES   = ["Initiate","Apprentice","Warrior","Elite","Champion","Master","Grandmaster","Legend","Mythic","Transcendent"];
const CHAR_TITLES   = ["Civilian","Awakened","Hunter","Ranked Fighter","Elite Operative","Shadow Walker","Dungeon Breaker","Monarch","Transcendent","Absolute"];
const CHAR_ICONS    = ["👤","🌀","🗡️","⚔️","🔱","🌑","🏯","👑","✨","🌌"];
const TASK_XP       = {E:10,B:25,S:50};
const GRACE_DAYS    = 3;
const DECAY         = 150;
const WILL_DECAY    = 250;

const STAT_CONFIG = {
  strength:    {name:"Strength",   icon:"⚔️", color:"#ff4444",glow:"rgba(255,68,68,0.5)"},
  power:       {name:"Power",      icon:"⚡", color:"#ff8c00",glow:"rgba(255,140,0,0.5)"},
  stamina:     {name:"Stamina",    icon:"🏃", color:"#00e676",glow:"rgba(0,230,118,0.5)"},
  flexibility: {name:"Flexibility",icon:"🌊", color:"#00bcd4",glow:"rgba(0,188,212,0.5)"},
  health:      {name:"Health",     icon:"❤️", color:"#ff4081",glow:"rgba(255,64,129,0.5)"},
  intellect:   {name:"Intellect",  icon:"📚", color:"#aa00ff",glow:"rgba(170,0,255,0.5)"},
  cyber:       {name:"Cyber",      icon:"💻", color:"#2979ff",glow:"rgba(41,121,255,0.5)"},
  soul:        {name:"Soul",       icon:"🔮", color:"#b388ff",glow:"rgba(179,136,255,0.5)"},
  will:        {name:"Will",       icon:"👁️", color:"#ffd600",glow:"rgba(255,214,0,0.5)"},
};

const STAT_DESCRIPTIONS = {
  strength:    "Heavy resistance training. Barbell, dumbbells, weighted calisthenics. Building raw muscle and structural strength over a lifetime.",
  power:       "Explosive athleticism. Sprints, clap push-ups, plyometrics, box jumps. Speed and force output — the edge that separates fighters.",
  stamina:     "Cardiovascular endurance. Running, cycling, rowing, sustained effort. Build the engine that never quits.",
  flexibility: "Mobility, stretching, yoga, deep tissue work. Joint health and range of motion — the foundation of longevity.",
  health:      "Nutrition and hydration discipline. Clean eating, zero junk. What you put in determines the ceiling on everything else.",
  intellect:   "Reading, studying, deep learning. Books, courses, research, synthesis. Sharpen the mind without mercy or pause.",
  cyber:       "Cybersecurity mastery. TryHackMe, CTFs, labs, certs, code. Technical skill that compounds silently over years.",
  soul:        "Inner work. Meditation, prayer, journaling, Gita study, deep reflection. The still point beneath all ambition.",
  will:        "Earned by feeding all other stats. The meta-discipline — undeniable proof of consistency across every domain.",
};

const DEFAULT_TASKS = {
  strength:    [{id:"str1",name:"Bodyweight circuit / light calisthenics",rank:"E"},{id:"str2",name:"Full strength training session",rank:"B"},{id:"str3",name:"Max effort strength + volume session",rank:"S"}],
  power:       [{id:"pow1",name:"Light plyometrics or banded work",rank:"E"},{id:"pow2",name:"Sprint or explosive training session",rank:"B"},{id:"pow3",name:"Full power/speed + heavy plyometrics",rank:"S"}],
  stamina:     [{id:"sta1",name:"20 min walk or light cardio",rank:"E"},{id:"sta2",name:"30-45 min moderate cardio",rank:"B"},{id:"sta3",name:"60+ min intense cardio or long run",rank:"S"}],
  flexibility: [{id:"fle1",name:"10 min stretching",rank:"E"},{id:"fle2",name:"20-30 min mobility or yoga",rank:"B"},{id:"fle3",name:"Full deep flexibility session 45+ min",rank:"S"}],
  health:      [{id:"hea1",name:"Mostly clean eating, decent hydration",rank:"E"},{id:"hea2",name:"Fully clean diet, good hydration",rank:"B"},{id:"hea3",name:"Perfect nutrition + hydration, no junk",rank:"S"}],
  intellect:   [{id:"int1",name:"30 min reading or general learning",rank:"E"},{id:"int2",name:"1-2 hour focused study session",rank:"B"},{id:"int3",name:"3+ hour deep learning / course completion",rank:"S"}],
  cyber:       [{id:"cyb1",name:"30 min TryHackMe / reading docs",rank:"E"},{id:"cyb2",name:"1-2 hour lab, CTF, or structured study",rank:"B"},{id:"cyb3",name:"3+ hour deep cyber / full room or cert module",rank:"S"}],
  soul:        [{id:"sou1",name:"10 min meditation or prayer",rank:"E"},{id:"sou2",name:"20-30 min meditation, journaling, or spiritual reading",rank:"B"},{id:"sou3",name:"Deep inner work / extended meditation / Gita study",rank:"S"}],
};

const SYSTEM_MSGS = {
  taskDone: ["The System acknowledges your effort.","Strength is not given. It is taken.","Your future self is watching.","Each rep. Each session. Each day."],
  levelUp:  ["A new rank has been achieved.","The System has recognized your growth.","Power commensurate with your efforts.","You have surpassed your former self."],
  allDone:  ["All daily objectives complete.","Maximum Will XP secured.","Today's dungeon has been cleared."],
  habit:    ["Habit reinforced.","Consistency compounds.","The System records every repetition.","One more rep in the book."],
};
const getRand = type => SYSTEM_MSGS[type][Math.floor(Math.random()*SYSTEM_MSGS[type].length)];

const getLevel  = xp => { for(let i=XP_THRESHOLDS.length-1;i>=0;i--) if(xp>=XP_THRESHOLDS[i]) return i+1; return 1; };
const todayStr  = ()  => new Date().toISOString().split("T")[0];
const daysSince = d   => !d ? 999 : Math.floor((Date.now()-new Date(d).getTime())/86400000);
const uid       = ()  => Math.random().toString(36).slice(2,9);
const daysAgo   = n   => { const d=new Date(); d.setDate(d.getDate()-n); return d.toISOString().split("T")[0]; };

function getLevelProgress(xp) {
  const lvl=getLevel(xp);
  if(lvl>=10) return {pct:100,cur:xp-XP_THRESHOLDS[9],need:1};
  const cur=xp-XP_THRESHOLDS[lvl-1], need=XP_THRESHOLDS[lvl]-XP_THRESHOLDS[lvl-1];
  return {pct:Math.floor((cur/need)*100),cur,need};
}
function getOverallLevel(statXP) {
  const keys=Object.keys(STAT_CONFIG);
  return Math.max(1,Math.floor(keys.reduce((s,k)=>s+getLevel(statXP[k]||0),0)/keys.length));
}
function decayStatus(stat,lastActivity) {
  const d=daysSince(lastActivity[stat]);
  if(d<=GRACE_DAYS) return {status:"safe",daysLeft:GRACE_DAYS-d};
  if(d===GRACE_DAYS+1) return {status:"warn",daysLeft:0};
  return {status:"decay",daysLeft:0,daysOver:d-GRACE_DAYS};
}
function calcWillXP(taskLog,sleepLog) {
  const today=todayStr();
  const fed=new Set(taskLog.filter(t=>t.date===today&&t.stat!=="will").map(t=>t.stat));
  const sleep=sleepLog.find(s=>s.date===today);
  const total=fed.size+(sleep?1:0);
  if(total>=8) return 200; if(total>=6) return 100; if(total>=4) return 40; return 0;
}
function calcStreak(taskLog,sleepLog) {
  let streak=0;
  for(let i=0;i<60;i++){
    const d=daysAgo(i);
    const fed=new Set(taskLog.filter(t=>t.date===d&&t.stat!=="will").map(t=>t.stat)).size;
    const slept=sleepLog.find(s=>s.date===d)?1:0;
    if(fed+slept>=4) streak++; else if(i>0) break;
  }
  return streak;
}
function todayXP(taskLog,sleepLog) {
  const today=todayStr();
  return taskLog.filter(t=>t.date===today).reduce((s,t)=>s+t.xp,0)+((sleepLog.find(s=>s.date===today)?.xp)||0);
}

const freshState = () => ({
  name:"Hunter",
  statXP:Object.fromEntries(Object.keys(STAT_CONFIG).map(k=>[k,0])),
  lastActivity:Object.fromEntries(Object.keys(STAT_CONFIG).map(k=>[k,null])),
  taskLog:[],
  sleepLog:[],
  customTasks:[],
  habits:[],
  hiddenTasks:[],
  taskNameOverrides:{},
  lastDecayCheck:null,
});

function useIsDesktop(breakpoint=900) {
  const [isDesktop,setIsDesktop]=useState(()=>typeof window!=="undefined"&&window.innerWidth>=breakpoint);
  useEffect(()=>{
    const fn=()=>setIsDesktop(window.innerWidth>=breakpoint);
    window.addEventListener("resize",fn);
    return ()=>window.removeEventListener("resize",fn);
  },[breakpoint]);
  return isDesktop;
}

const injectStyles = () => {
  if(document.getElementById("rpg-css")) return;
  const s=document.createElement("style"); s.id="rpg-css";
  s.textContent=`
    @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;600;700&family=Orbitron:wght@400;700;900&family=Share+Tech+Mono&display=swap');
    html,body{margin:0;padding:0;background:#030308;overflow-x:hidden;width:100%;}
    #root,#__next{background:#030308;min-height:100vh;width:100%;}
    .rpg,.rpg*{box-sizing:border-box;} .rpg{font-family:'Rajdhani',sans-serif;}
    @keyframes fadeIn  {from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
    @keyframes slideUp {from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}
    @keyframes slideIn {from{opacity:0;transform:translateX(-16px)}to{opacity:1;transform:none}}
    @keyframes scan    {0%{top:-5%}100%{top:105%}}
    @keyframes pulse   {0%,100%{opacity:.4}50%{opacity:1}}
    @keyframes bpulse  {0%,100%{border-color:rgba(41,121,255,.25)}50%{border-color:rgba(41,121,255,.6)}}
    @keyframes lvlUp   {0%{opacity:0;transform:scale(.7)}20%{opacity:1;transform:scale(1.08)}80%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(1.04)}}
    @keyframes shimmer {0%{background-position:-200% center}100%{background-position:200% center}}
    @keyframes float   {0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
    @keyframes popIn   {0%{transform:scale(.8);opacity:0}60%{transform:scale(1.15)}100%{transform:scale(1);opacity:1}}
    .fade  {animation:fadeIn .22s ease both;}
    .slide {animation:slideUp .28s cubic-bezier(.2,.8,.2,1) both;}
    .slideIn{animation:slideIn .22s cubic-bezier(.2,.8,.2,1) both;}
    .scanl {position:absolute;left:0;right:0;height:1px;background:linear-gradient(90deg,transparent,rgba(41,121,255,.1),transparent);animation:scan 5s linear infinite;pointer-events:none;}
    .sc{transition:transform .18s,box-shadow .18s;cursor:pointer;}.sc:hover{transform:translateY(-3px);box-shadow:0 8px 24px rgba(0,0,0,.4);}
    .tr:hover{background:rgba(255,255,255,.04)!important;}
    .nb:hover{background:rgba(41,121,255,.13)!important;}
    .pb{transition:all .13s;}.pb:hover{filter:brightness(1.18);transform:scale(1.04);}
    .rp{transition:all .12s;cursor:pointer;}.rp:hover{opacity:1!important;}
    .dp{animation:pulse 1.4s infinite;}
    .bp{animation:bpulse 3s infinite;}
    .float{animation:float 3s ease-in-out infinite;}
    .shimmer{background:linear-gradient(90deg,#ffd600,#fff,#ffd600);background-size:200% auto;-webkit-background-clip:text;-webkit-text-fill-color:transparent;animation:shimmer 2s linear infinite;}
    .lvl-anim{animation:lvlUp 3s ease forwards;}
    .pop{animation:popIn .25s cubic-bezier(.2,.8,.2,1);}
    .habit-btn{transition:all .15s;}
    .habit-btn:hover{filter:brightness(1.2);}
    .snav-btn{transition:all .15s;cursor:pointer;}
    .snav-btn:hover{background:rgba(255,255,255,.05)!important;color:#aaa!important;}
    .stat-desc{color:#252538;transition:color .25s;font-size:11px;font-family:'Share Tech Mono',monospace;line-height:1.5;margin-top:8px;}
    .sc:hover .stat-desc{color:#5a5a7a;}
    @media(max-width:900px){.stat-desc{color:#32324a!important;}}
    ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:#070710}::-webkit-scrollbar-thumb{background:#1a1a2e;border-radius:2px}
  `;
  document.head.appendChild(s);
};

// ── SHARED ───────────────────────────────────────────────────────────────────
const RP = ({rank,sel,onClick}) => {
  const c={E:"#666",B:"#00bcd4",S:"#ffd600"}[rank];
  return <button className="rp" onClick={onClick} style={{background:sel?c:"transparent",color:sel?"#000":c,border:`1px solid ${c}`,borderRadius:3,padding:"3px 10px",fontSize:11,fontFamily:"'Orbitron',monospace",fontWeight:700,opacity:sel?1:.42,letterSpacing:1}}>{rank}</button>;
};

const XPBar = ({xp,color,glow,thin}) => {
  const {pct,cur,need}=getLevelProgress(xp);
  return (
    <div>
      <div style={{height:thin?3:7,background:"rgba(255,255,255,.05)",borderRadius:3,overflow:"hidden"}}>
        <div style={{width:`${pct}%`,height:"100%",background:`linear-gradient(90deg,${color}77,${color})`,boxShadow:`0 0 7px ${glow}`,borderRadius:3,transition:"width .6s cubic-bezier(.4,0,.2,1)"}}/>
      </div>
      {!thin&&<div style={{display:"flex",justifyContent:"space-between",marginTop:4,fontSize:10,color:"#3a3a4a",fontFamily:"'Share Tech Mono',monospace"}}><span>{cur.toLocaleString()}/{need.toLocaleString()} XP</span><span>{pct}%</span></div>}
    </div>
  );
};

// ── LEVEL TABLE ──────────────────────────────────────────────────────────────
const LevelTable = ({currentXP,color,glow,statName,onClose}) => {
  const curLvl=getLevel(currentXP);
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.88)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>
      <div className="slide" onClick={e=>e.stopPropagation()} style={{background:"#0a0a14",border:`1px solid ${color}44`,borderRadius:12,padding:"24px 20px",width:"100%",maxWidth:420,maxHeight:"85vh",overflow:"auto",boxShadow:`0 0 40px ${glow}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <div>
            <div style={{fontFamily:"'Orbitron',monospace",fontSize:13,fontWeight:700,color:"#fff",letterSpacing:1}}>RANK PROGRESSION</div>
            <div style={{fontSize:11,color,marginTop:2}}>{statName}</div>
          </div>
          <button onClick={onClose} style={{background:"transparent",border:"none",color:"#444",fontSize:20,cursor:"pointer"}}>✕</button>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:7}}>
          {STAT_TITLES.map((title,i)=>{
            const lvl=i+1,reached=curLvl>=lvl,isCur=curLvl===lvl;
            return (
              <div key={i} style={{background:isCur?`${color}18`:reached?"rgba(255,255,255,.03)":"transparent",border:`1px solid ${isCur?color:reached?"rgba(255,255,255,.08)":"rgba(255,255,255,.03)"}`,borderRadius:8,padding:"12px 14px",position:"relative",overflow:"hidden",boxShadow:isCur?`0 0 14px ${glow}`:""}}>
                {isCur&&<div style={{position:"absolute",left:0,top:0,bottom:0,width:3,background:color}}/>}
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{fontFamily:"'Orbitron',monospace",fontSize:20,fontWeight:900,color:reached?color:"#222",minWidth:30,textAlign:"center"}}>{lvl}</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:14,fontWeight:700,color:isCur?"#fff":reached?"#aaa":"#333"}}>{title}</div>
                    <div style={{fontSize:10,color:"#444",fontFamily:"'Share Tech Mono',monospace",marginTop:2}}>{XP_THRESHOLDS[i].toLocaleString()} XP{XP_THRESHOLDS[i+1]?` → ${XP_THRESHOLDS[i+1].toLocaleString()} XP`:""}</div>
                  </div>
                  <div style={{fontSize:15}}>{reached?(isCur?"📍":"✓"):"🔒"}</div>
                </div>
                {isCur&&<div style={{marginTop:9}}><div style={{height:3,background:"rgba(255,255,255,.05)",borderRadius:2,overflow:"hidden"}}><div style={{width:`${getLevelProgress(currentXP).pct}%`,height:"100%",background:color,borderRadius:2}}/></div></div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ── STAT DETAIL ──────────────────────────────────────────────────────────────
const StatDetail = ({sk,state,onClose,onLevelTable,isDesktop}) => {
  const cfg=STAT_CONFIG[sk],xp=state.statXP[sk],lvl=getLevel(xp);
  const ds=decayStatus(sk,state.lastActivity);
  const days7=Array.from({length:7},(_,i)=>{
    const d=daysAgo(6-i);
    const tasks=(state.taskLog||[]).filter(t=>t.date===d&&t.stat===sk);
    return {d,xpEarned:tasks.reduce((s,t)=>s+t.xp,0)};
  });
  const maxXP=Math.max(...days7.map(d=>d.xpEarned),1);
  const align=isDesktop?"center":"flex-end";
  const radius=isDesktop?"12px":"14px 14px 0 0";
  const mw=isDesktop?540:"100%";
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.88)",zIndex:400,display:"flex",alignItems:align,justifyContent:"center",padding:isDesktop?"20px":"0"}}>
      <div className="slide" onClick={e=>e.stopPropagation()} style={{background:"#0a0a14",border:`1px solid ${cfg.color}44`,borderRadius:radius,padding:"24px 22px 40px",width:"100%",maxWidth:mw,maxHeight:"85vh",overflow:"auto",boxShadow:`0 -10px 40px ${cfg.glow}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
          <div style={{display:"flex",alignItems:"center",gap:12}}>
            <span style={{fontSize:26}}>{cfg.icon}</span>
            <div>
              <div style={{fontFamily:"'Orbitron',monospace",fontSize:15,fontWeight:700,color:"#fff",letterSpacing:1}}>{cfg.name.toUpperCase()}</div>
              <button onClick={()=>{onClose();onLevelTable();}} style={{fontFamily:"'Orbitron',monospace",fontSize:10,color:cfg.color,background:"transparent",border:"none",cursor:"pointer",padding:0,textDecoration:"underline",textDecorationStyle:"dotted"}}>LVL {lvl} · {STAT_TITLES[lvl-1]} ↗</button>
            </div>
          </div>
          <button onClick={onClose} style={{background:"transparent",border:"none",color:"#444",fontSize:20,cursor:"pointer"}}>✕</button>
        </div>
        <div style={{background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.05)",borderRadius:8,padding:"10px 13px",marginBottom:16}}>
          <div style={{fontSize:11,color:"#555",fontFamily:"'Share Tech Mono',monospace",lineHeight:1.6,fontStyle:"italic"}}>{STAT_DESCRIPTIONS[sk]}</div>
        </div>
        <div style={{marginBottom:18}}><XPBar xp={xp} color={cfg.color} glow={cfg.glow} thin={false}/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:9,marginBottom:22}}>
          {[["TOTAL XP",xp.toLocaleString(),cfg.color],["LEVEL",lvl,"#ffd600"],["DECAY",ds.status==="safe"?`${ds.daysLeft}d safe`:ds.status==="warn"?"TOMORROW":"ACTIVE",ds.status==="safe"?"#00e676":ds.status==="warn"?"#ff8c00":"#ff1744"]].map(([l,v,c])=>(
            <div key={l} style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)",borderRadius:7,padding:"12px 8px",textAlign:"center"}}>
              <div style={{fontFamily:"'Orbitron',monospace",fontSize:15,fontWeight:700,color:c}}>{v}</div>
              <div style={{fontSize:9,color:"#444",fontFamily:"'Share Tech Mono',monospace",marginTop:2}}>{l}</div>
            </div>
          ))}
        </div>
        <div style={{marginBottom:18}}>
          <div style={{fontSize:9,color:"#333",fontFamily:"'Orbitron',monospace",letterSpacing:1.5,marginBottom:10}}>── LAST 7 DAYS ────────────</div>
          <div style={{display:"flex",gap:5,alignItems:"flex-end",height:64}}>
            {days7.map(({d,xpEarned},i)=>{
              const h=xpEarned>0?Math.max(8,Math.floor((xpEarned/maxXP)*54)):4;
              const isToday=d===todayStr();
              return (
                <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                  <div style={{width:"100%",height:h,background:xpEarned>0?cfg.color:"rgba(255,255,255,.06)",borderRadius:"3px 3px 0 0",boxShadow:xpEarned>0?`0 0 8px ${cfg.glow}`:"none",border:isToday?`1px solid ${cfg.color}`:"none"}}/>
                  <div style={{fontSize:8,color:isToday?cfg.color:"#333",fontFamily:"'Share Tech Mono',monospace"}}>{new Date(d+"T12:00:00").toLocaleDateString("en-US",{weekday:"short"}).slice(0,2)}</div>
                  {xpEarned>0&&<div style={{fontSize:8,color:cfg.color,fontFamily:"'Orbitron',monospace"}}>+{xpEarned}</div>}
                </div>
              );
            })}
          </div>
        </div>
        <div style={{background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.06)",borderRadius:8,padding:"12px 14px"}}>
          <div style={{fontSize:10,color:"#444",fontFamily:"'Orbitron',monospace",letterSpacing:1,marginBottom:6}}>STATUS</div>
          <div style={{fontSize:13,color:"#bbb"}}>Last session: <span style={{color:"#fff",fontWeight:700}}>{state.lastActivity[sk]?`${daysSince(state.lastActivity[sk])}d ago`:"Never"}</span></div>
          {ds.status==="safe"&&<div style={{fontSize:12,color:"#00e676",marginTop:4}}>✓ Safe for {ds.daysLeft} more day{ds.daysLeft!==1?"s":""}</div>}
          {ds.status==="warn"&&<div style={{fontSize:12,color:"#ff8c00",marginTop:4}}>⚠ Decay begins tomorrow</div>}
          {ds.status==="decay"&&<div style={{fontSize:12,color:"#ff1744",marginTop:4}}>▼ Decaying {ds.daysOver} day{ds.daysOver!==1?"s":""} — -{ds.daysOver*DECAY} XP lost</div>}
        </div>
      </div>
    </div>
  );
};

// ── LEVEL UP OVERLAY ─────────────────────────────────────────────────────────
const LevelUpOverlay = ({stat,newLevel,onDone}) => {
  const cfg=STAT_CONFIG[stat]||{name:stat,icon:"⭐",color:"#ffd600",glow:"rgba(255,214,0,0.5)"};
  useEffect(()=>{ const t=setTimeout(onDone,3200); return ()=>clearTimeout(t); },[]);
  return (
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.92)",zIndex:500,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",pointerEvents:"none"}}>
      <div className="lvl-anim" style={{textAlign:"center",padding:"0 30px",position:"relative"}}>
        <div style={{fontSize:52,marginBottom:12,animation:"float 1s ease-in-out infinite"}}>{cfg.icon}</div>
        <div style={{fontFamily:"'Orbitron',monospace",fontSize:12,color:cfg.color,letterSpacing:4,marginBottom:8}}>── RANK UP ──</div>
        <div style={{fontFamily:"'Orbitron',monospace",fontSize:30,fontWeight:900,marginBottom:6,color:"#fff",textShadow:`0 0 30px ${cfg.color}`}}>{cfg.name.toUpperCase()}</div>
        <div className="shimmer" style={{fontFamily:"'Orbitron',monospace",fontSize:22,fontWeight:700,marginBottom:16}}>{STAT_TITLES[newLevel-1].toUpperCase()}</div>
        <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:13,color:"#555",fontStyle:"italic",maxWidth:280,margin:"0 auto",lineHeight:1.6}}>"{getRand("levelUp")}"</div>
        <div style={{marginTop:22,fontFamily:"'Orbitron',monospace",fontSize:12,color:cfg.color}}>LEVEL {newLevel}</div>
        {Array.from({length:12},(_,i)=>(
          <div key={i} style={{position:"absolute",width:3,height:3,borderRadius:"50%",background:cfg.color,left:`${8+i*8}%`,top:`${15+Math.sin(i)*35}%`,opacity:.6,animation:`pulse ${.8+i*.15}s ${i*.1}s infinite`}}/>
        ))}
      </div>
    </div>
  );
};

// ── SYSTEM MESSAGE ───────────────────────────────────────────────────────────
const SysMsg = ({msg,color,onDone}) => {
  useEffect(()=>{ const t=setTimeout(onDone,2800); return ()=>clearTimeout(t); },[]);
  return (
    <div style={{position:"fixed",top:64,left:"50%",transform:"translateX(-50%)",zIndex:600,maxWidth:360,width:"90%",animation:"fadeIn .2s ease"}}>
      <div style={{background:"rgba(7,7,16,.97)",border:`1px solid ${color||"#2979ff"}`,borderRadius:9,padding:"12px 16px",boxShadow:`0 0 20px ${color||"#2979ff"}44`}}>
        <div style={{fontSize:9,color:color||"#2979ff",fontFamily:"'Orbitron',monospace",letterSpacing:2,marginBottom:4}}>[ SYSTEM ]</div>
        <div style={{fontSize:13,color:"#ccc",fontFamily:"'Share Tech Mono',monospace",lineHeight:1.5}}>{msg}</div>
      </div>
    </div>
  );
};

// ── TASK/HABIT CREATION MODAL ────────────────────────────────────────────────
const CreateModal = ({stat,mode,onAdd,onClose,isDesktop}) => {
  const [name,setName]=useState(""); const [rank,setRank]=useState("B");
  const cfg=STAT_CONFIG[stat];
  const isHabit=mode==="habit";
  const align=isDesktop?"center":"flex-end";
  const radius=isDesktop?"12px":"14px 14px 0 0";
  const mw=isDesktop?460:"100%";
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.84)",zIndex:300,display:"flex",alignItems:align,justifyContent:"center",padding:isDesktop?"20px":"0"}}>
      <div className="slide" onClick={e=>e.stopPropagation()} style={{background:"#0d0d1a",border:`1px solid ${isHabit?"#ffd600":cfg.color}44`,borderRadius:radius,padding:"24px 22px 36px",width:"100%",maxWidth:mw,boxShadow:`0 -10px 40px ${isHabit?"rgba(255,214,0,.3)":cfg.glow}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
          <div>
            <div style={{fontFamily:"'Orbitron',monospace",fontSize:13,fontWeight:700,color:"#fff",letterSpacing:1}}>{isHabit?"ADD HABIT":"ADD CUSTOM TASK"}</div>
            <div style={{fontSize:11,color:isHabit?"#ffd600":cfg.color,marginTop:2}}>{cfg.icon} {cfg.name.toUpperCase()} · {isHabit?"Repeatable anytime":"Daily reset"}</div>
          </div>
          <button onClick={onClose} style={{background:"transparent",border:"none",color:"#444",fontSize:20,cursor:"pointer"}}>✕</button>
        </div>
        <div style={{marginBottom:16}}>
          <div style={{fontSize:10,color:"#444",fontFamily:"'Orbitron',monospace",letterSpacing:1,marginBottom:7}}>{isHabit?"HABIT NAME":"TASK NAME"}</div>
          <input value={name} onChange={e=>setName(e.target.value)} placeholder={isHabit?"e.g. 10 pull-ups":"e.g. Run 5km"} autoFocus
            onKeyDown={e=>{if(e.key==="Enter"&&name.trim()) onAdd(name.trim(),rank);}}
            style={{width:"100%",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.1)",borderRadius:6,color:"#fff",padding:"12px 14px",fontFamily:"'Rajdhani',sans-serif",fontSize:16,outline:"none"}}/>
        </div>
        {isHabit&&<div style={{background:"rgba(255,214,0,.06)",border:"1px solid rgba(255,214,0,.15)",borderRadius:7,padding:"10px 12px",marginBottom:16}}>
          <div style={{fontSize:11,color:"#ffd600",fontFamily:"'Share Tech Mono',monospace",lineHeight:1.5}}>💡 Habits can be logged multiple times per day. Each press gives XP and is recorded separately.</div>
        </div>}
        <div style={{marginBottom:22}}>
          <div style={{fontSize:10,color:"#444",fontFamily:"'Orbitron',monospace",letterSpacing:1,marginBottom:9}}>XP PER LOG</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
            {[["E","10 XP","Easy"],["B","25 XP","Moderate"],["S","50 XP","Hard"]].map(([r,xp,label])=>(
              <button key={r} onClick={()=>setRank(r)} style={{background:rank===r?`${isHabit?"#ffd600":cfg.color}18`:"rgba(255,255,255,.02)",border:`1px solid ${rank===r?(isHabit?"#ffd600":cfg.color):"rgba(255,255,255,.07)"}`,borderRadius:7,padding:"12px 6px",cursor:"pointer",transition:"all .15s"}}>
                <div style={{fontFamily:"'Orbitron',monospace",fontSize:18,fontWeight:700,color:rank===r?(isHabit?"#ffd600":cfg.color):"#444"}}>{r}</div>
                <div style={{fontSize:12,color:rank===r?"#fff":"#333",fontWeight:600,marginTop:2}}>{xp}</div>
                <div style={{fontSize:10,color:"#333",marginTop:1}}>{label}</div>
              </button>
            ))}
          </div>
        </div>
        <button className="pb" onClick={()=>{if(name.trim()) onAdd(name.trim(),rank);}} style={{width:"100%",background:`linear-gradient(135deg,${isHabit?"#ffd60099,#ffd600":`${cfg.color}99,${cfg.color}`})`,color:"#000",border:"none",borderRadius:8,padding:"14px",cursor:"pointer",fontFamily:"'Orbitron',monospace",fontSize:12,fontWeight:700,letterSpacing:1.5,opacity:name.trim()?1:.35}}>
          {isHabit?"CREATE HABIT":"CREATE TASK"} · +{TASK_XP[rank]} XP
        </button>
      </div>
    </div>
  );
};

// ── EDIT NAME MODAL ──────────────────────────────────────────────────────────
const EditNameModal = ({currentName,onSave,onClose}) => {
  const [val,setVal]=useState(currentName);
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.84)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>
      <div className="slide" onClick={e=>e.stopPropagation()} style={{background:"#0d0d1a",border:"1px solid rgba(255,255,255,.15)",borderRadius:12,padding:"24px 22px",width:"100%",maxWidth:400}}>
        <div style={{fontFamily:"'Orbitron',monospace",fontSize:13,fontWeight:700,color:"#fff",letterSpacing:1,marginBottom:4}}>RENAME TASK</div>
        <div style={{fontSize:10,color:"#444",fontFamily:"'Share Tech Mono',monospace",marginBottom:16}}>Edit the name for this task</div>
        <input value={val} onChange={e=>setVal(e.target.value)} autoFocus
          onKeyDown={e=>{if(e.key==="Enter"&&val.trim()) onSave(val.trim());}}
          style={{width:"100%",background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.15)",borderRadius:6,color:"#fff",padding:"12px 14px",fontFamily:"'Rajdhani',sans-serif",fontSize:16,outline:"none",marginBottom:16}}/>
        <div style={{display:"flex",gap:10}}>
          <button onClick={onClose} style={{flex:1,background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.1)",color:"#777",borderRadius:7,padding:"11px",cursor:"pointer",fontFamily:"'Orbitron',monospace",fontSize:10}}>CANCEL</button>
          <button onClick={()=>{if(val.trim()) onSave(val.trim());}} style={{flex:1,background:"linear-gradient(135deg,#2979ff99,#2979ff)",color:"#fff",border:"none",borderRadius:7,padding:"11px",cursor:"pointer",fontFamily:"'Orbitron',monospace",fontSize:10,fontWeight:700}}>SAVE</button>
        </div>
      </div>
    </div>
  );
};

// ── RESET MODAL ──────────────────────────────────────────────────────────────
const ResetModal = ({onConfirm,onClose}) => (
  <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.88)",zIndex:300,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 24px"}}>
    <div className="slide" onClick={e=>e.stopPropagation()} style={{background:"#0d0d1a",border:"1px solid rgba(255,68,68,.45)",borderRadius:12,padding:"30px 24px",width:"100%",maxWidth:400,boxShadow:"0 0 40px rgba(255,68,68,.2)"}}>
      <div style={{textAlign:"center",marginBottom:24}}>
        <div style={{fontSize:30,marginBottom:10}}>⚠️</div>
        <div style={{fontFamily:"'Orbitron',monospace",fontSize:14,fontWeight:700,color:"#ff4444",letterSpacing:1,marginBottom:10}}>RESET ALL DATA</div>
        <div style={{fontSize:13,color:"#555",lineHeight:1.7}}>Wipes all XP, levels, history, and logs. Your name is kept. Cannot be undone.</div>
      </div>
      <div style={{display:"flex",gap:10}}>
        <button onClick={onClose} style={{flex:1,background:"rgba(255,255,255,.04)",border:"1px solid rgba(255,255,255,.1)",color:"#777",borderRadius:7,padding:"13px",cursor:"pointer",fontFamily:"'Orbitron',monospace",fontSize:10}}>CANCEL</button>
        <button onClick={onConfirm} style={{flex:1,background:"linear-gradient(135deg,#ff444499,#ff4444)",color:"#fff",border:"none",borderRadius:7,padding:"13px",cursor:"pointer",fontFamily:"'Orbitron',monospace",fontSize:10,fontWeight:700}}>CONFIRM RESET</button>
      </div>
    </div>
  </div>
);

// ── ARCHIVE ──────────────────────────────────────────────────────────────────
const Archive = ({taskLog,sleepLog,isDesktop}) => {
  const [filter,setFilter]=useState("all");
  const allDates=[...new Set([...(taskLog||[]).map(t=>t.date),...(sleepLog||[]).map(s=>s.date)])].sort((a,b)=>b.localeCompare(a));
  const filtered=filter==="all"?(taskLog||[]):(taskLog||[]).filter(t=>t.stat===filter);
  const totalXPAll=(taskLog||[]).reduce((s,t)=>s+t.xp,0)+((sleepLog||[]).reduce((s,t)=>s+t.xp,0));
  return (
    <div className="fade" style={{padding:isDesktop?"28px 32px 0":"20px 16px 0"}}>
      {!isDesktop&&<div style={{fontFamily:"'Orbitron',monospace",fontSize:14,fontWeight:700,color:"#fff",letterSpacing:2,marginBottom:3}}>📜 ARCHIVE</div>}
      {!isDesktop&&<div style={{fontSize:10,color:"#333",fontFamily:"'Share Tech Mono',monospace",marginBottom:16}}>Complete activity history</div>}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:9,marginBottom:16}}>
        {[["TOTAL XP",totalXPAll.toLocaleString(),"#ffd600"],["ACTIVE DAYS",allDates.length,"#2979ff"]].map(([l,v,c])=>(
          <div key={l} style={{background:"#0d0d1a",border:"1px solid rgba(255,255,255,.07)",borderRadius:9,padding:"12px",textAlign:"center"}}>
            <div style={{fontFamily:"'Orbitron',monospace",fontSize:18,fontWeight:700,color:c}}>{v}</div>
            <div style={{fontSize:9,color:"#444",fontFamily:"'Share Tech Mono',monospace",marginTop:2}}>{l}</div>
          </div>
        ))}
      </div>
      <div style={{display:"flex",gap:5,overflowX:"auto",paddingBottom:8,marginBottom:16,scrollbarWidth:"none"}}>
        {["all",...Object.keys(STAT_CONFIG).filter(k=>k!=="will")].map(k=>{
          const on=filter===k,c=k==="all"?"#2979ff":STAT_CONFIG[k]?.color||"#2979ff";
          return <button key={k} onClick={()=>setFilter(k)} style={{background:on?c:"rgba(255,255,255,.04)",color:on?"#000":"#444",border:`1px solid ${on?c:"rgba(255,255,255,.07)"}`,borderRadius:20,padding:"4px 12px",cursor:"pointer",fontFamily:"'Orbitron',monospace",fontSize:9,fontWeight:700,letterSpacing:.5,whiteSpace:"nowrap",flexShrink:0,transition:"all .15s"}}>{k==="all"?"ALL":STAT_CONFIG[k]?.icon+" "+k.slice(0,3).toUpperCase()}</button>;
        })}
      </div>
      {allDates.length===0&&<div style={{textAlign:"center",color:"#2a2a3a",fontSize:13,fontFamily:"'Share Tech Mono',monospace",marginTop:60,lineHeight:2}}>No activity yet.<br/>Complete tasks to build your log.</div>}
      {allDates.map(date=>{
        const dayTasks=filtered.filter(t=>t.date===date&&t.stat!=="will");
        const daySleep=sleepLog?.find(s=>s.date===date);
        if(!dayTasks.length&&(!daySleep||(filter!=="all"&&filter!=="health"))) return null;
        const totalXP=dayTasks.reduce((s,t)=>s+t.xp,0)+(daySleep?.xp||0);
        return (
          <div key={date} style={{marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:6}}>
              <div style={{fontFamily:"'Orbitron',monospace",fontSize:10,color:"#2979ff",letterSpacing:1}}>{new Date(date+"T12:00:00").toLocaleDateString("en-US",{weekday:"short",month:"short",day:"numeric"})}</div>
              {totalXP>0&&<div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:10,color:"#ffd600"}}>+{totalXP}</div>}
            </div>
            <div style={{background:"#0d0d1a",border:"1px solid rgba(255,255,255,.06)",borderRadius:9,overflow:"hidden"}}>
              {dayTasks.map((t,i)=>{
                const cfg=STAT_CONFIG[t.stat];
                return (
                  <div key={i} style={{display:"flex",alignItems:"center",gap:10,padding:"11px 14px",borderBottom:i<dayTasks.length-1||daySleep?"1px solid rgba(255,255,255,.04)":"none"}}>
                    <span style={{fontSize:14}}>{cfg?.icon}</span>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontSize:13,color:"#bbb",fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{t.taskName||"Task"}</div>
                      <div style={{fontSize:9,color:"#333",fontFamily:"'Orbitron',monospace",marginTop:1}}>{cfg?.name?.toUpperCase()} · {t.rank}-RANK{t.isHabit?" · HABIT":t.isCustom?" · CUSTOM":""}</div>
                    </div>
                    <div style={{fontFamily:"'Orbitron',monospace",fontSize:11,color:cfg?.color,flexShrink:0}}>+{t.xp}</div>
                  </div>
                );
              })}
              {daySleep&&(filter==="all"||filter==="health")&&(
                <div style={{display:"flex",alignItems:"center",gap:10,padding:"11px 14px"}}>
                  <span style={{fontSize:14}}>🌙</span>
                  <div style={{flex:1}}><div style={{fontSize:13,color:"#bbb",fontWeight:600}}>{daySleep.hours}h sleep</div><div style={{fontSize:9,color:"#333",fontFamily:"'Orbitron',monospace",marginTop:1}}>HEALTH · SLEEP</div></div>
                  <div style={{fontFamily:"'Orbitron',monospace",fontSize:11,color:"#ff4081",flexShrink:0}}>+{daySleep.xp}</div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

// ── MAIN ─────────────────────────────────────────────────────────────────────
export default function App() {
  useEffect(()=>{ injectStyles(); },[]);

  const isDesktop = useIsDesktop(900);

  const [state,       setState]       = useState(null);
  const [view,        setView]        = useState("dashboard");
  const [activeStat,  setActiveStat]  = useState(null);
  const [todayDone,   setTodayDone]   = useState({});
  const [rankSel,     setRankSel]     = useState({});
  const [sleepInput,  setSleepInput]  = useState("");
  const [toast,       setToast]       = useState(null);
  const [createMode,  setCreateMode]  = useState(null);
  const [showReset,   setShowReset]   = useState(false);
  const [editTarget,  setEditTarget]  = useState(null);
  const [editName_,   setEditName_]   = useState(false);
  const [nameInput,   setNameInput]   = useState("");
  const [levelUpQ,    setLevelUpQ]    = useState([]);
  const [sysMsg,      setSysMsg]      = useState(null);
  const [statDetail,  setStatDetail]  = useState(null);
  const [levelTable,  setLevelTable]  = useState(null);
  const [habitPops,   setHabitPops]   = useState({});
  const prevXP = useRef({});

  useEffect(()=>{
    try{ const r=localStorage.getItem("rpgState_v6"); setState(r?JSON.parse(r):freshState()); }
    catch{ setState(freshState()); }
  },[]);

  useEffect(()=>{ if(state) localStorage.setItem("rpgState_v6",JSON.stringify(state)); },[state]);

  useEffect(()=>{
    if(!state) return;
    const done={};
    (state.taskLog||[]).filter(t=>t.date===todayStr()&&!t.isHabit).forEach(t=>{ done[t.taskId]=t.rank; });
    setTodayDone(done);
  },[state]);

  useEffect(()=>{
    if(!state) return;
    const prev=prevXP.current;
    const ups=[];
    Object.keys(STAT_CONFIG).forEach(k=>{
      if(prev[k]!==undefined){ const o=getLevel(prev[k]||0),n=getLevel(state.statXP[k]||0); if(n>o) ups.push({stat:k,newLevel:n}); }
    });
    if(ups.length) setLevelUpQ(q=>[...q,...ups]);
    prevXP.current={...state.statXP};
  },[state?.statXP]);

  useEffect(()=>{
    if(!state) return;
    const today=todayStr();
    if(state.lastDecayCheck===today) return;
    setState(prev=>{
      const newXP={...prev.statXP};
      Object.keys(STAT_CONFIG).forEach(k=>{
        const d=daysSince(prev.lastActivity[k]);
        if(d>GRACE_DAYS){ const dd=d-GRACE_DAYS; newXP[k]=Math.max(0,newXP[k]-(k==="will"?WILL_DECAY:DECAY)*dd); }
      });
      return {...prev,statXP:newXP,lastDecayCheck:today};
    });
  },[state?.lastDecayCheck]);

  const toast$  = (msg,color="#00e676") => { setToast({msg,color}); setTimeout(()=>setToast(null),2400); };
  const showSys = (msg,color) => setSysMsg({msg,color});

  const completeTask = (taskId,taskName,stat,rank,isCustom=false) => {
    if(todayDone[taskId]) return;
    const xp=TASK_XP[rank],today=todayStr();
    setState(prev=>{
      const newXP={...prev.statXP,[stat]:prev.statXP[stat]+xp};
      const newLast={...prev.lastActivity,[stat]:today};
      const newLog=[...(prev.taskLog||[]),{date:today,taskId,taskName,stat,rank,xp,isCustom}];
      const delta=calcWillXP(newLog,prev.sleepLog)-calcWillXP(prev.taskLog,prev.sleepLog);
      if(delta!==0){ newXP.will=Math.max(0,newXP.will+delta); newLast.will=today; }
      const statKeys=Object.keys(STAT_CONFIG).filter(k=>k!=="will");
      const allFed=statKeys.every(k=>newLog.some(t=>t.date===today&&t.stat===k&&!t.isHabit));
      setTimeout(()=>showSys(getRand(allFed?"allDone":"taskDone"),allFed?"#ffd600":STAT_CONFIG[stat].color),300);
      return {...prev,statXP:newXP,lastActivity:newLast,taskLog:newLog};
    });
    toast$(`+${xp} ${STAT_CONFIG[stat].name} XP`);
  };

  const logHabit = (habit) => {
    const xp=TASK_XP[habit.rank],today=todayStr();
    setState(prev=>{
      const newXP={...prev.statXP,[habit.stat]:prev.statXP[habit.stat]+xp};
      const newLast={...prev.lastActivity,[habit.stat]:today};
      const newLog=[...(prev.taskLog||[]),{date:today,taskId:habit.id,taskName:habit.name,stat:habit.stat,rank:habit.rank,xp,isHabit:true}];
      const delta=calcWillXP(newLog,prev.sleepLog)-calcWillXP(prev.taskLog,prev.sleepLog);
      if(delta!==0){ newXP.will=Math.max(0,newXP.will+delta); newLast.will=today; }
      return {...prev,statXP:newXP,lastActivity:newLast,taskLog:newLog};
    });
    setHabitPops(p=>({...p,[habit.id]:(p[habit.id]||0)+1}));
    setTimeout(()=>setHabitPops(p=>({...p,[habit.id]:(p[habit.id]||1)-1})),400);
    toast$(`+${xp} ${STAT_CONFIG[habit.stat].name} XP (habit)`,"#ffd600");
    setTimeout(()=>showSys(getRand("habit"),"#ffd600"),300);
  };

  const addTask = (stat,name,rank) => {
    setState(prev=>({...prev,customTasks:[...(prev.customTasks||[]),{id:"c_"+uid(),stat,name,rank,isCustom:true}]}));
    setCreateMode(null); toast$("Task created","#2979ff");
  };
  const addHabit = (stat,name,rank) => {
    setState(prev=>({...prev,habits:[...(prev.habits||[]),{id:"h_"+uid(),stat,name,rank,isHabit:true}]}));
    setCreateMode(null); toast$("Habit created","#ffd600");
  };

  const deleteTask = (task) => {
    if(task.isHabit) setState(prev=>({...prev,habits:(prev.habits||[]).filter(h=>h.id!==task.id)}));
    else if(task.isCustom) setState(prev=>({...prev,customTasks:(prev.customTasks||[]).filter(t=>t.id!==task.id)}));
    else setState(prev=>({...prev,hiddenTasks:[...(prev.hiddenTasks||[]),task.id]}));
  };

  const saveTaskName = (task,newName) => {
    if(task.isHabit) setState(prev=>({...prev,habits:(prev.habits||[]).map(h=>h.id===task.id?{...h,name:newName}:h)}));
    else if(task.isCustom) setState(prev=>({...prev,customTasks:(prev.customTasks||[]).map(t=>t.id===task.id?{...t,name:newName}:t)}));
    else setState(prev=>({...prev,taskNameOverrides:{...(prev.taskNameOverrides||{}),[task.id]:newName}}));
    setEditTarget(null);
  };

  const logSleep = () => {
    const h=parseFloat(sleepInput);
    if(isNaN(h)||h<0||h>24) return;
    const xp=h>=8?80:h>=7?50:h>=6?25:0, today=todayStr();
    setState(prev=>{
      const newSleep=[...(prev.sleepLog||[]).filter(s=>s.date!==today),{date:today,hours:h,xp}];
      const newXP={...prev.statXP,health:prev.statXP.health+xp};
      const newLast={...prev.lastActivity,health:today};
      const delta=calcWillXP(prev.taskLog,newSleep)-calcWillXP(prev.taskLog,prev.sleepLog);
      if(delta!==0){ newXP.will=Math.max(0,newXP.will+delta); newLast.will=today; }
      return {...prev,statXP:newXP,lastActivity:newLast,sleepLog:newSleep};
    });
    toast$(xp>0?`+${xp} Health XP`:"Logged — aim for 7+",xp>0?"#00e676":"#ff8c00");
    setSleepInput(""); if(!isDesktop) setView("dashboard");
  };

  const resetAll = () => {
    const f=freshState(); f.name=state.name;
    setState(f); prevXP.current={};
    setShowReset(false); setView("dashboard");
    toast$("System reset","#ff4444");
  };

  if(!state) return (
    <div style={{background:"#030308",height:"100vh",width:"100%",display:"flex",alignItems:"center",justifyContent:"center",flexDirection:"column",gap:14}}>
      <div style={{fontFamily:"'Orbitron',monospace",color:"#2979ff",fontSize:14,letterSpacing:3}}>INITIALIZING</div>
      <div style={{display:"flex",gap:6}}>{[0,1,2].map(i=><div key={i} style={{width:7,height:7,borderRadius:"50%",background:"#2979ff",animation:`pulse ${.8+i*.2}s ${i*.2}s infinite`}}/>)}</div>
    </div>
  );

  const today      = todayStr();
  const ovLvl      = getOverallLevel(state.statXP);
  const sleepToday = (state.sleepLog||[]).find(s=>s.date===today);
  const statKeys   = Object.keys(STAT_CONFIG).filter(k=>k!=="will");
  const statsFedN  = new Set((state.taskLog||[]).filter(t=>t.date===today&&t.stat!=="will"&&!t.isHabit).map(t=>t.stat)).size;
  const totalFed   = statsFedN+(sleepToday?1:0);
  const streak     = calcStreak(state.taskLog||[],state.sleepLog||[]);
  const xpToday    = todayXP(state.taskLog||[],state.sleepLog||[]);
  const decayAlerts= statKeys.filter(k=>decayStatus(k,state.lastActivity).status!=="safe");

  const willBonus  = totalFed>=8?200:totalFed>=6?100:totalFed>=4?40:0;

  const getStatTasks = (key) => [
    ...(DEFAULT_TASKS[key]||[]).filter(t=>!(state.hiddenTasks||[]).includes(t.id)).map(t=>({...t,name:(state.taskNameOverrides||{})[t.id]||t.name})),
    ...(state.customTasks||[]).filter(t=>t.stat===key),
  ];
  const getStatHabits = (key) => (state.habits||[]).filter(h=>h.stat===key);
  const habitCountToday = (habitId) => (state.taskLog||[]).filter(t=>t.date===today&&t.taskId===habitId&&t.isHabit).length;

  const SIDEBAR_W = 270;

  // ── DESKTOP SIDEBAR ────────────────────────────────────────────────────────
  const DesktopSidebar = () => (
    <div className="slideIn" style={{
      position:"fixed",left:0,top:0,width:SIDEBAR_W,height:"100vh",
      background:"#06060f",borderRight:"1px solid rgba(255,255,255,.07)",
      display:"flex",flexDirection:"column",zIndex:200,overflowY:"auto",
    }}>
      <div style={{position:"absolute",top:0,left:0,right:0,bottom:0,overflow:"hidden",pointerEvents:"none"}}>
        <div className="scanl"/>
      </div>

      {/* Branding */}
      <div style={{padding:"22px 20px 18px",borderBottom:"1px solid rgba(255,255,255,.05)",position:"relative"}}>
        <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:9,color:"#2979ff",letterSpacing:3,marginBottom:3}}>[ SYSTEM v2.0 ]</div>
        <div style={{fontFamily:"'Orbitron',monospace",fontSize:16,fontWeight:900,color:"#fff",letterSpacing:2}}>LEVELING OS</div>
      </div>

      {/* Character */}
      <div style={{padding:"18px 20px",borderBottom:"1px solid rgba(255,255,255,.05)"}}>
        <div style={{display:"flex",alignItems:"center",gap:12,marginBottom:14}}>
          <div className="float" style={{fontSize:30,lineHeight:1,filter:"drop-shadow(0 0 8px rgba(41,121,255,.4))"}}>{CHAR_ICONS[ovLvl-1]}</div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontFamily:"'Orbitron',monospace",fontSize:14,fontWeight:900,color:"#fff",letterSpacing:1,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{state.name}</div>
            <button onClick={()=>setLevelTable({xp:0,color:"#2979ff",glow:"rgba(41,121,255,0.5)",name:"Overall Level"})} style={{fontFamily:"'Orbitron',monospace",fontSize:8,color:"#2979ff",letterSpacing:1,background:"transparent",border:"none",cursor:"pointer",padding:0,textDecoration:"underline",textDecorationStyle:"dotted"}}>{CHAR_TITLES[ovLvl-1].toUpperCase()} ↗</button>
          </div>
          <div style={{textAlign:"right",flexShrink:0}}>
            <div style={{fontFamily:"'Orbitron',monospace",fontSize:28,fontWeight:900,color:"#ffd600",lineHeight:1,textShadow:"0 0 14px rgba(255,214,0,.5)"}}>{ovLvl}</div>
            <div style={{fontSize:8,color:"#333",fontFamily:"'Share Tech Mono',monospace"}}>OVRL</div>
          </div>
        </div>

        {/* Will */}
        <div style={{marginBottom:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
            <button onClick={()=>setLevelTable({xp:state.statXP.will,color:"#ffd600",glow:"rgba(255,214,0,0.5)",name:"Will"})} style={{fontFamily:"'Orbitron',monospace",fontSize:9,color:"#ffd600",letterSpacing:.8,background:"transparent",border:"none",cursor:"pointer",padding:0,textDecoration:"underline",textDecorationStyle:"dotted"}}>👁️ WILL — LVL {getLevel(state.statXP.will)} ↗</button>
            <span style={{fontFamily:"'Orbitron',monospace",fontSize:10,color:"#ffd600",fontWeight:700}}>{state.statXP.will.toLocaleString()}</span>
          </div>
          <XPBar xp={state.statXP.will} color="#ffd600" glow="rgba(255,214,0,.5)" thin/>
        </div>

        {/* Today progress dots */}
        <div style={{marginBottom:10}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:8,color:"#333",fontFamily:"'Share Tech Mono',monospace",marginBottom:5}}>
            <span>TODAY {totalFed}/9</span>
            <span style={{color:totalFed>=8?"#ffd600":totalFed>=4?"#00e676":"#444"}}>WILL +{willBonus}</span>
          </div>
          <div style={{display:"flex",gap:2}}>
            {[...statKeys,"sleep"].map((k,i)=>{
              const fed=k==="sleep"?!!sleepToday:(state.taskLog||[]).some(t=>t.date===today&&t.stat===k&&!t.isHabit);
              return <div key={i} style={{flex:1,height:4,borderRadius:2,background:fed?"#2979ff":"rgba(255,255,255,.07)",boxShadow:fed?"0 0 4px #2979ff":"none",transition:"all .3s"}}/>;
            })}
          </div>
        </div>

        {/* Streak + XP chips */}
        <div style={{display:"flex",gap:7}}>
          {[[streak>0?"🔥":"💤",`${streak}d streak`,streak>0?"#ff8c00":"#333"],["⚡",`+${xpToday} today`,"#ffd600"]].map(([icon,label,c])=>(
            <div key={label} style={{flex:1,background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.05)",borderRadius:6,padding:"6px 8px",display:"flex",alignItems:"center",gap:5}}>
              <span style={{fontSize:12}}>{icon}</span>
              <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:9,color:c,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Nav */}
      <div style={{padding:"14px 12px",flex:1}}>
        {[
          {id:"dashboard",label:"HOME",icon:"◈"},
          {id:"sleep",label:"SLEEP LOG",icon:"🌙"},
          {id:"archive",label:"ACTIVITY LOG",icon:"📜"},
        ].map(n=>(
          <button key={n.id} className="snav-btn" onClick={()=>setView(n.id)} style={{
            width:"100%",display:"flex",alignItems:"center",gap:10,
            background:view===n.id?"rgba(41,121,255,.12)":"transparent",
            border:view===n.id?"1px solid rgba(41,121,255,.28)":"1px solid transparent",
            color:view===n.id?"#2979ff":"#444",
            borderRadius:7,padding:"12px 14px",cursor:"pointer",
            fontFamily:"'Orbitron',monospace",fontSize:10,letterSpacing:.8,fontWeight:700,
            marginBottom:4,transition:"all .15s",textAlign:"left",
          }}>
            <span style={{fontSize:14,minWidth:18,textAlign:"center"}}>{n.icon}</span>
            {n.label}
            {view===n.id&&<div style={{marginLeft:"auto",width:5,height:5,borderRadius:"50%",background:"#2979ff",boxShadow:"0 0 6px #2979ff"}}/>}
          </button>
        ))}

        {/* Decay alerts in sidebar */}
        {decayAlerts.length>0&&(
          <div style={{marginTop:14,background:"rgba(255,23,68,.05)",border:"1px solid rgba(255,23,68,.2)",borderRadius:7,padding:"12px 13px"}}>
            <div style={{fontSize:8,color:"#ff1744",fontFamily:"'Orbitron',monospace",letterSpacing:2,marginBottom:8}}>⚠ DECAY ALERTS</div>
            {decayAlerts.map(k=>{
              const cfg=STAT_CONFIG[k],ds=decayStatus(k,state.lastActivity);
              return <div key={k} onClick={()=>{setActiveStat(k);setView("tasks");}} style={{display:"flex",alignItems:"center",gap:8,cursor:"pointer",marginBottom:5,padding:"3px 0"}}>
                <span style={{fontSize:13}}>{cfg.icon}</span>
                <span style={{fontSize:11,color:"#ccc",flex:1,fontWeight:600}}>{cfg.name}</span>
                <span className="dp" style={{fontSize:8,color:ds.status==="warn"?"#ff8c00":"#ff1744",fontFamily:"'Orbitron',monospace"}}>{ds.status==="warn"?"SOON":"▼"}</span>
              </div>;
            })}
          </div>
        )}
      </div>

      {/* Reset */}
      <div style={{padding:"14px 12px",borderTop:"1px solid rgba(255,255,255,.05)"}}>
        <button onClick={()=>setShowReset(true)} style={{
          width:"100%",background:"transparent",border:"1px solid rgba(255,68,68,.12)",
          color:"rgba(255,68,68,.35)",borderRadius:6,padding:"9px",cursor:"pointer",
          fontFamily:"'Orbitron',monospace",fontSize:9,letterSpacing:1,
          transition:"all .15s",
        }}>⚙️ RESET SYSTEM</button>
      </div>
    </div>
  );

  return (
    <div style={{background:"#030308",minHeight:"100vh",width:"100%"}}>
      <div className="rpg" style={{background:"#070710",minHeight:"100vh",width:"100%",position:"relative",paddingBottom:80}}>

      {/* Fixed overlays */}
      {!isDesktop&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,overflow:"hidden",pointerEvents:"none",zIndex:0}}>
          <div className="scanl"/>
        </div>
      )}

      {toast&&<div style={{position:"fixed",top:18,left:"50%",transform:"translateX(-50%)",background:"#0d0d1a",border:`1px solid ${toast.color}`,color:toast.color,padding:"9px 18px",borderRadius:7,fontFamily:"'Orbitron',monospace",fontSize:11,letterSpacing:1,zIndex:700,boxShadow:`0 0 16px ${toast.color}44`,whiteSpace:"nowrap",animation:"fadeIn .18s ease"}}>{toast.msg}</div>}
      {sysMsg&&<SysMsg msg={sysMsg.msg} color={sysMsg.color} onDone={()=>setSysMsg(null)}/>}
      {levelUpQ.length>0&&<LevelUpOverlay stat={levelUpQ[0].stat} newLevel={levelUpQ[0].newLevel} onDone={()=>setLevelUpQ(q=>q.slice(1))}/>}
      {createMode&&activeStat&&<CreateModal stat={activeStat} mode={createMode} onAdd={(n,r)=>createMode==="habit"?addHabit(activeStat,n,r):addTask(activeStat,n,r)} onClose={()=>setCreateMode(null)} isDesktop={isDesktop}/>}
      {showReset&&<ResetModal onConfirm={resetAll} onClose={()=>setShowReset(false)}/>}
      {editTarget&&<EditNameModal currentName={editTarget.currentName} onSave={(n)=>saveTaskName(editTarget,n)} onClose={()=>setEditTarget(null)}/>}
      {statDetail&&<StatDetail sk={statDetail} state={state} onClose={()=>setStatDetail(null)} isDesktop={isDesktop} onLevelTable={()=>{ const cfg=STAT_CONFIG[statDetail]; setLevelTable({xp:state.statXP[statDetail],color:cfg.color,glow:cfg.glow,name:cfg.name}); }}/>}
      {levelTable&&<LevelTable currentXP={levelTable.xp} color={levelTable.color} glow={levelTable.glow} statName={levelTable.name} onClose={()=>setLevelTable(null)}/>}

      {/* Desktop sidebar */}
      {isDesktop&&<DesktopSidebar/>}

      {/* Main content */}
      <div style={{
        marginLeft:isDesktop?SIDEBAR_W:0,
        paddingBottom:isDesktop?48:80,
        position:"relative",zIndex:1,
        minHeight:"100vh",
      }}>
        <div style={{
          maxWidth:isDesktop?1040:"100%",
          margin:isDesktop?"0 auto":"0",
        }}>

          {/* ══ DASHBOARD ═══════════════════════════════════════ */}
          {view==="dashboard"&&(
            <div className="fade" style={{padding:isDesktop?"30px 36px 0":"18px 14px 0"}}>

              {/* Desktop page header */}
              {isDesktop&&(
                <div style={{marginBottom:26,paddingBottom:18,borderBottom:"1px solid rgba(255,255,255,.05)"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-end"}}>
                    <div>
                      <div style={{fontFamily:"'Orbitron',monospace",fontSize:22,fontWeight:900,color:"#fff",letterSpacing:2}}>DASHBOARD</div>
                      <div style={{fontSize:11,color:"#2a2a3a",fontFamily:"'Share Tech Mono',monospace",marginTop:4}}>{new Date().toLocaleDateString("en-US",{weekday:"long",month:"long",day:"numeric",year:"numeric"})}</div>
                    </div>
                    <div style={{display:"flex",gap:10,alignItems:"center"}}>
                      <div onClick={()=>setView("sleep")} style={{background:"rgba(255,64,129,.08)",border:"1px solid rgba(255,64,129,.2)",borderRadius:7,padding:"8px 14px",cursor:"pointer",display:"flex",alignItems:"center",gap:8,transition:"all .15s"}}>
                        <span style={{fontSize:14}}>🌙</span>
                        <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:10,color:sleepToday?"#ff4081":"#444"}}>{sleepToday?`${sleepToday.hours}h sleep · +${sleepToday.xp}xp`:"Log sleep →"}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Mobile character card */}
              {!isDesktop&&(
                <div className="bp" style={{background:"linear-gradient(135deg,#0d0d2a,#0a0a18)",border:"1px solid rgba(41,121,255,.25)",borderRadius:12,padding:"18px 16px",marginBottom:14,position:"relative",overflow:"hidden",boxShadow:"0 0 28px rgba(41,121,255,.1)"}}>
                  <div style={{position:"absolute",top:0,left:0,right:0,height:2,background:"linear-gradient(90deg,transparent,#2979ff,transparent)"}}/>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:14}}>
                    <div style={{display:"flex",alignItems:"center",gap:12}}>
                      <div className="float" style={{fontSize:34,lineHeight:1,filter:"drop-shadow(0 0 8px rgba(41,121,255,.5))"}}>{CHAR_ICONS[ovLvl-1]}</div>
                      <div>
                        {editName_?(
                          <div style={{display:"flex",gap:6,alignItems:"center"}}>
                            <input value={nameInput} onChange={e=>setNameInput(e.target.value)} autoFocus
                              onKeyDown={e=>{if(e.key==="Enter"){setState(p=>({...p,name:nameInput||p.name}));setEditName_(false);}}}
                              style={{background:"rgba(255,255,255,.05)",border:"1px solid #2979ff",borderRadius:4,color:"#fff",padding:"5px 9px",fontFamily:"'Orbitron',monospace",fontSize:13,width:118,outline:"none"}}/>
                            <button onClick={()=>{setState(p=>({...p,name:nameInput||p.name}));setEditName_(false);}} style={{background:"#2979ff",color:"#fff",border:"none",borderRadius:4,padding:"5px 10px",cursor:"pointer",fontSize:10,fontFamily:"'Orbitron',monospace"}}>SET</button>
                          </div>
                        ):(
                          <div style={{display:"flex",alignItems:"center",gap:7}}>
                            <div style={{fontFamily:"'Orbitron',monospace",fontSize:18,fontWeight:900,color:"#fff",letterSpacing:2}}>{state.name}</div>
                            <button onClick={()=>{setNameInput(state.name);setEditName_(true);}} style={{background:"transparent",border:"none",color:"#2a2a3a",cursor:"pointer",fontSize:11,padding:0}}>✏️</button>
                          </div>
                        )}
                        <button onClick={()=>setLevelTable({xp:0,color:"#2979ff",glow:"rgba(41,121,255,0.5)",name:"Overall Level"})} style={{fontFamily:"'Orbitron',monospace",fontSize:9,color:"#2979ff",letterSpacing:1.5,marginTop:2,background:"transparent",border:"none",cursor:"pointer",padding:0,textDecoration:"underline",textDecorationStyle:"dotted"}}>
                          {CHAR_TITLES[ovLvl-1].toUpperCase()} ↗
                        </button>
                      </div>
                    </div>
                    <div style={{textAlign:"right"}}>
                      <div style={{fontFamily:"'Orbitron',monospace",fontSize:38,fontWeight:900,color:"#ffd600",lineHeight:1,textShadow:"0 0 18px rgba(255,214,0,.55)"}}>{ovLvl}</div>
                      <div style={{fontSize:9,color:"#333",fontFamily:"'Share Tech Mono',monospace"}}>OVERALL LVL</div>
                    </div>
                  </div>
                  <div style={{display:"flex",gap:9,marginBottom:13}}>
                    {[[streak>0?"🔥":"💤",`${streak}d streak`,streak>0?"#ff8c00":"#333"],["⚡",`+${xpToday} XP today`,"#ffd600"]].map(([icon,label,c])=>(
                      <div key={label} style={{flex:1,background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)",borderRadius:7,padding:"7px 9px",display:"flex",alignItems:"center",gap:6}}>
                        <span style={{fontSize:13}}>{icon}</span>
                        <span style={{fontFamily:"'Share Tech Mono',monospace",fontSize:10,color:c}}>{label}</span>
                      </div>
                    ))}
                  </div>
                  <div style={{marginBottom:12}}>
                    <div style={{display:"flex",justifyContent:"space-between",fontSize:9,color:"#333",fontFamily:"'Share Tech Mono',monospace",marginBottom:5}}>
                      <span>TODAY · {totalFed}/9 STATS FED</span>
                      <span style={{color:totalFed>=8?"#ffd600":totalFed>=6?"#00e676":totalFed>=4?"#ff8c00":"#333"}}>WILL +{willBonus}</span>
                    </div>
                    <div style={{display:"flex",gap:3}}>
                      {[...statKeys,"sleep"].map((k,i)=>{
                        const fed=k==="sleep"?!!sleepToday:(state.taskLog||[]).some(t=>t.date===today&&t.stat===k&&!t.isHabit);
                        return <div key={i} style={{flex:1,height:5,borderRadius:2,background:fed?"#2979ff":"rgba(255,255,255,.06)",boxShadow:fed?"0 0 5px #2979ff":"none",transition:"all .3s"}}/>;
                      })}
                    </div>
                  </div>
                  <div style={{paddingTop:12,borderTop:"1px solid rgba(255,255,255,.05)"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:6}}>
                      <span style={{fontSize:14}}>👁️</span>
                      <button onClick={()=>setLevelTable({xp:state.statXP.will,color:"#ffd600",glow:"rgba(255,214,0,0.5)",name:"Will"})} style={{fontFamily:"'Orbitron',monospace",fontSize:10,color:"#ffd600",letterSpacing:.8,flex:1,background:"transparent",border:"none",cursor:"pointer",textAlign:"left",padding:0,textDecoration:"underline",textDecorationStyle:"dotted"}}>
                        WILL — LVL {getLevel(state.statXP.will)} · {STAT_TITLES[getLevel(state.statXP.will)-1]} ↗
                      </button>
                      <span style={{fontFamily:"'Orbitron',monospace",fontSize:12,fontWeight:700,color:"#ffd600",textShadow:"0 0 8px rgba(255,214,0,.5)"}}>{state.statXP.will.toLocaleString()}</span>
                    </div>
                    <XPBar xp={state.statXP.will} color="#ffd600" glow="rgba(255,214,0,.5)" thin/>
                  </div>
                </div>
              )}

              {/* Decay alerts — mobile only */}
              {!isDesktop&&decayAlerts.length>0&&(
                <div style={{background:"rgba(255,23,68,.06)",border:"1px solid rgba(255,23,68,.25)",borderRadius:9,padding:"12px 14px",marginBottom:14}}>
                  <div style={{fontSize:9,color:"#ff1744",fontFamily:"'Orbitron',monospace",letterSpacing:2,marginBottom:8}}>⚠ SYSTEM ALERT</div>
                  {decayAlerts.map(k=>{
                    const cfg=STAT_CONFIG[k],ds=decayStatus(k,state.lastActivity);
                    return <div key={k} onClick={()=>{setActiveStat(k);setView("tasks");}} style={{display:"flex",alignItems:"center",gap:9,cursor:"pointer",marginBottom:5}}>
                      <span style={{fontSize:14}}>{cfg.icon}</span>
                      <span style={{fontSize:12,color:"#ccc",fontWeight:600,flex:1}}>{cfg.name}</span>
                      <span className="dp" style={{fontSize:10,color:ds.status==="warn"?"#ff8c00":"#ff1744",fontFamily:"'Orbitron',monospace"}}>{ds.status==="warn"?"DECAY TOMORROW":"DECAYING"} →</span>
                    </div>;
                  })}
                </div>
              )}

              {/* Mobile sleep card */}
              {!isDesktop&&(
                <div style={{background:"#0d0d1a",border:"1px solid rgba(255,255,255,.07)",borderRadius:9,padding:"12px 14px",marginBottom:14,display:"flex",alignItems:"center",gap:10}}>
                  <span style={{fontSize:18}}>🌙</span>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:700,color:"#ccc",letterSpacing:.6}}>SLEEP</div>
                    <div style={{fontSize:9,color:"#333",fontFamily:"'Share Tech Mono',monospace",marginTop:1}}>{sleepToday?`${sleepToday.hours}h · +${sleepToday.xp} Health XP`:"Not logged today"}</div>
                  </div>
                  <button onClick={()=>setView("sleep")} style={{background:"rgba(41,121,255,.1)",border:"1px solid rgba(41,121,255,.3)",color:"#2979ff",borderRadius:5,padding:"6px 13px",cursor:"pointer",fontFamily:"'Orbitron',monospace",fontSize:9,letterSpacing:1}}>{sleepToday?"EDIT":"LOG"}</button>
                </div>
              )}

              {/* Stats section header */}
              <div style={{fontSize:9,color:"#222",fontFamily:"'Orbitron',monospace",letterSpacing:2,marginBottom:isDesktop?14:10}}>── STATS {isDesktop?"──────────────────────────────────────────":"──────────────────"}</div>

              {/* Stat grid */}
              <div style={{display:"grid",gridTemplateColumns:isDesktop?"repeat(3,1fr)":"1fr 1fr",gap:isDesktop?14:10}}>
                {statKeys.map(key=>{
                  const cfg=STAT_CONFIG[key],xp=state.statXP[key],lvl=getLevel(xp);
                  const ds=decayStatus(key,state.lastActivity);
                  const dc=ds.status==="warn"?"#ff8c00":ds.status==="decay"?"#ff1744":"transparent";
                  return (
                    <div key={key} className="sc" style={{background:"linear-gradient(135deg,#0d0d1a,#0a0a12)",border:`1px solid ${ds.status!=="safe"?dc:"rgba(255,255,255,.07)"}`,borderRadius:10,padding:isDesktop?"20px":"16px 14px",position:"relative",overflow:"hidden",boxShadow:ds.status!=="safe"?`0 0 14px ${dc}33`:"none"}}>
                      {ds.status!=="safe"&&<div className="dp" style={{position:"absolute",top:7,right:9,fontSize:8,color:dc,fontFamily:"'Orbitron',monospace"}}>{ds.status==="warn"?"⚠ SOON":"▼ DECAY"}</div>}

                      {/* Stat header */}
                      <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:10}}>
                        <span style={{fontSize:isDesktop?22:20,cursor:"pointer"}} onClick={()=>setStatDetail(key)}>{cfg.icon}</span>
                        <div style={{flex:1,minWidth:0,cursor:"pointer"}} onClick={()=>setStatDetail(key)}>
                          <div style={{fontSize:isDesktop?14:13,fontWeight:700,color:"#ddd",letterSpacing:.7,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{cfg.name.toUpperCase()}</div>
                        </div>
                        <button onClick={()=>setLevelTable({xp,color:cfg.color,glow:cfg.glow,name:cfg.name})} style={{fontFamily:"'Orbitron',monospace",fontSize:9,color:cfg.color,background:"transparent",border:"none",cursor:"pointer",padding:0,flexShrink:0,textDecoration:"underline",textDecorationStyle:"dotted"}}>Lv{lvl} ↗</button>
                      </div>

                      {/* XP Bar */}
                      <div onClick={()=>setStatDetail(key)}><XPBar xp={xp} color={cfg.color} glow={cfg.glow} thin={false}/></div>

                      {/* Stat description — faint by default, brighter on hover via CSS */}
                      <div className="stat-desc">{STAT_DESCRIPTIONS[key]}</div>

                      {/* Tasks button */}
                      <button onClick={()=>{setActiveStat(key);setView("tasks");}} style={{marginTop:10,width:"100%",background:`${cfg.color}11`,border:`1px solid ${cfg.color}22`,color:cfg.color,borderRadius:5,padding:"6px",cursor:"pointer",fontFamily:"'Orbitron',monospace",fontSize:9,letterSpacing:.5}}>TASKS →</button>
                    </div>
                  );
                })}
              </div>

              {/* Remaining today */}
              {(()=>{
                const remaining=statKeys.flatMap(key=>getStatTasks(key).filter(t=>!todayDone[t.id]).map(t=>({...t,stat:key})));
                const sleepPending=!sleepToday;
                const totalLeft=remaining.length+(sleepPending?1:0);
                return (
                  <div style={{marginTop:isDesktop?32:22,paddingBottom:10}}>
                    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12}}>
                      <div style={{fontSize:9,color:"#222",fontFamily:"'Orbitron',monospace",letterSpacing:2}}>── REMAINING TODAY {isDesktop?"────────────────────────":"────────"}</div>
                      <div style={{fontFamily:"'Orbitron',monospace",fontSize:10,color:totalLeft===0?"#00e676":totalLeft<=5?"#ff8c00":"#555"}}>{totalLeft===0?"✓ ALL DONE":`${totalLeft} LEFT`}</div>
                    </div>
                    {totalLeft===0?(
                      <div style={{background:"rgba(0,230,118,.04)",border:"1px solid rgba(0,230,118,.14)",borderRadius:10,padding:"22px",textAlign:"center"}}>
                        <div style={{fontSize:26,marginBottom:8}}>⚔️</div>
                        <div style={{fontFamily:"'Orbitron',monospace",fontSize:11,color:"#00e676",letterSpacing:1}}>ALL TASKS COMPLETE</div>
                        <div style={{fontSize:10,color:"#2a2a3a",fontFamily:"'Share Tech Mono',monospace",marginTop:5}}>Will XP maximized</div>
                      </div>
                    ):(
                      <div style={{
                        display:isDesktop?"grid":"flex",
                        gridTemplateColumns:isDesktop?"1fr 1fr":undefined,
                        flexDirection:!isDesktop?"column":undefined,
                        gap:isDesktop?12:7,
                        alignItems:"start",
                      }}>
                        {sleepPending&&(
                          <div style={{background:"#0d0d1a",border:"1px solid rgba(255,64,129,.2)",borderRadius:9,padding:"12px 14px",display:"flex",alignItems:"center",gap:10}}>
                            <span style={{fontSize:16}}>🌙</span>
                            <div style={{flex:1}}><div style={{fontSize:13,color:"#ccc",fontWeight:600}}>Log last night's sleep</div></div>
                            <button onClick={()=>setView("sleep")} style={{background:"rgba(255,64,129,.12)",border:"1px solid rgba(255,64,129,.3)",color:"#ff4081",borderRadius:5,padding:"6px 12px",cursor:"pointer",fontFamily:"'Orbitron',monospace",fontSize:9,flexShrink:0}}>LOG</button>
                          </div>
                        )}
                        {statKeys.map(key=>{
                          const sp=remaining.filter(t=>t.stat===key);
                          if(!sp.length) return null;
                          const cfg=STAT_CONFIG[key];
                          return (
                            <div key={key} style={{background:"#0d0d1a",border:`1px solid ${cfg.color}1a`,borderRadius:9,overflow:"hidden"}}>
                              <div onClick={()=>{setActiveStat(key);setView("tasks");}} style={{display:"flex",alignItems:"center",gap:8,padding:"10px 14px",borderBottom:"1px solid rgba(255,255,255,.05)",cursor:"pointer",background:`${cfg.color}08`}}>
                                <span style={{fontSize:14}}>{cfg.icon}</span>
                                <span style={{fontFamily:"'Orbitron',monospace",fontSize:10,color:cfg.color,letterSpacing:.8,fontWeight:700,flex:1}}>{cfg.name.toUpperCase()}</span>
                                <span style={{fontSize:10,color:"#333"}}>→</span>
                              </div>
                              {sp.map((task,i)=>{
                                const sel=rankSel[task.id]||task.rank;
                                return (
                                  <div key={task.id} className="tr" style={{display:"flex",alignItems:"center",gap:9,padding:"11px 14px",borderBottom:i<sp.length-1?"1px solid rgba(255,255,255,.04)":"none",transition:"background .14s"}}>
                                    <div style={{flex:1,minWidth:0}}><div style={{fontSize:13,color:"#bbb",fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{task.name}</div></div>
                                    <div style={{display:"flex",gap:4,alignItems:"center",flexShrink:0}}>
                                      {["E","B","S"].map(r=><RP key={r} rank={r} sel={sel===r} onClick={()=>setRankSel(p=>({...p,[task.id]:r}))}/>)}
                                      <button className="pb" onClick={()=>completeTask(task.id,task.name,key,sel,task.isCustom||false)} style={{background:`linear-gradient(135deg,${cfg.color}99,${cfg.color})`,color:"#000",border:"none",borderRadius:5,padding:"6px 12px",cursor:"pointer",fontFamily:"'Orbitron',monospace",fontSize:9,fontWeight:700,boxShadow:`0 0 7px ${cfg.glow}`,marginLeft:2}}>+{TASK_XP[sel]}</button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* ══ TASKS ════════════════════════════════════════════ */}
          {view==="tasks"&&activeStat&&(()=>{
            const cfg=STAT_CONFIG[activeStat];
            const allT=getStatTasks(activeStat);
            const pending=allT.filter(t=>!todayDone[t.id]);
            const done=allT.filter(t=>!!todayDone[t.id]);
            const habits=getStatHabits(activeStat);
            return (
              <div className="fade" style={{padding:isDesktop?"30px 36px 0":"18px 14px 0"}}>
                {!isDesktop&&<button onClick={()=>setView("dashboard")} style={{background:"transparent",border:"none",color:"#444",cursor:"pointer",fontSize:13,marginBottom:14,display:"flex",alignItems:"center",gap:5,fontFamily:"'Rajdhani',sans-serif"}}>← Back</button>}
                {isDesktop&&<button onClick={()=>setView("dashboard")} style={{background:"transparent",border:"1px solid rgba(255,255,255,.08)",color:"#555",cursor:"pointer",fontSize:10,marginBottom:22,display:"inline-flex",alignItems:"center",gap:7,fontFamily:"'Orbitron',monospace",letterSpacing:.5,padding:"6px 14px",borderRadius:5}}>← BACK TO DASHBOARD</button>}

                <div style={{background:`linear-gradient(135deg,${cfg.color}0e,#0a0a12)`,border:`1px solid ${cfg.color}30`,borderRadius:12,padding:isDesktop?"20px":"16px",marginBottom:18,boxShadow:`0 0 18px ${cfg.glow}`}}>
                  <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                    <span style={{fontSize:22}}>{cfg.icon}</span>
                    <div style={{flex:1}}>
                      <div style={{fontFamily:"'Orbitron',monospace",fontSize:15,fontWeight:700,color:"#fff",letterSpacing:1.2}}>{cfg.name.toUpperCase()}</div>
                      <button onClick={()=>setLevelTable({xp:state.statXP[activeStat],color:cfg.color,glow:cfg.glow,name:cfg.name})} style={{fontFamily:"'Share Tech Mono',monospace",fontSize:10,color:cfg.color,background:"transparent",border:"none",cursor:"pointer",padding:0,textDecoration:"underline",textDecorationStyle:"dotted"}}>
                        LVL {getLevel(state.statXP[activeStat])} · {STAT_TITLES[getLevel(state.statXP[activeStat])-1]} · {state.statXP[activeStat].toLocaleString()} XP ↗
                      </button>
                    </div>
                    {isDesktop&&(
                      <div style={{textAlign:"right",flexShrink:0}}>
                        <div style={{fontFamily:"'Orbitron',monospace",fontSize:24,fontWeight:900,color:cfg.color,lineHeight:1}}>{getLevel(state.statXP[activeStat])}</div>
                        <div style={{fontSize:8,color:"#333",fontFamily:"'Share Tech Mono',monospace"}}>LVL</div>
                      </div>
                    )}
                  </div>
                  <XPBar xp={state.statXP[activeStat]} color={cfg.color} glow={cfg.glow} thin={false}/>
                  <div style={{marginTop:8,fontSize:11,color:"#555",fontFamily:"'Share Tech Mono',monospace",fontStyle:"italic"}}>{STAT_DESCRIPTIONS[activeStat]}</div>
                  <div style={{marginTop:6,fontSize:9,color:"#2a2a3a",fontFamily:"'Share Tech Mono',monospace"}}>
                    Last: {state.lastActivity[activeStat]?`${daysSince(state.lastActivity[activeStat])}d ago`:"Never"} · {(()=>{const ds=decayStatus(activeStat,state.lastActivity);return ds.status==="safe"?<span style={{color:"#00e676"}}>✓ Safe {ds.daysLeft}d</span>:ds.status==="warn"?<span style={{color:"#ff8c00"}}>⚠ Decay tomorrow</span>:<span style={{color:"#ff1744"}}>▼ Decaying</span>;})()}
                  </div>
                </div>

                {/* Two-column layout on desktop */}
                <div style={{display:isDesktop?"grid":"block",gridTemplateColumns:isDesktop?"1fr 1fr":undefined,gap:isDesktop?22:0,alignItems:"start"}}>

                  {/* Daily tasks column */}
                  <div>
                    {(pending.length>0||done.length>0)&&<div style={{fontSize:9,color:"#222",fontFamily:"'Orbitron',monospace",letterSpacing:2,marginBottom:10}}>── DAILY TASKS ────────────</div>}
                    {pending.length>0&&(
                      <div style={{display:"flex",flexDirection:"column",gap:7,marginBottom:12}}>
                        {pending.map(task=>{
                          const sel=rankSel[task.id]||task.rank;
                          return (
                            <div key={task.id} className="tr" style={{background:"#0d0d1a",border:"1px solid rgba(255,255,255,.07)",borderRadius:9,padding:"13px 14px",transition:"background .14s"}}>
                              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",gap:9,marginBottom:11}}>
                                <div style={{flex:1,minWidth:0}}>
                                  <div style={{fontSize:14,color:"#ccc",fontWeight:600,lineHeight:1.35,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{task.name}</div>
                                  {task.isCustom&&<div style={{fontSize:9,color:"#2a2a3a",fontFamily:"'Orbitron',monospace",marginTop:1}}>CUSTOM</div>}
                                </div>
                                <div style={{display:"flex",gap:6,flexShrink:0}}>
                                  <button onClick={()=>setEditTarget({id:task.id,currentName:task.name,isCustom:task.isCustom,isHabit:false})} style={{background:"transparent",border:"none",color:"#2a2a3a",cursor:"pointer",fontSize:13,padding:0,lineHeight:1}}>✏️</button>
                                  <button onClick={()=>deleteTask(task)} style={{background:"transparent",border:"none",color:"#2a2a3a",cursor:"pointer",fontSize:13,padding:0,lineHeight:1}}>🗑</button>
                                </div>
                              </div>
                              <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",gap:8}}>
                                <div style={{display:"flex",gap:5}}>{["E","B","S"].map(r=><RP key={r} rank={r} sel={sel===r} onClick={()=>setRankSel(p=>({...p,[task.id]:r}))}/>)}</div>
                                <button className="pb" onClick={()=>completeTask(task.id,task.name,activeStat,sel,task.isCustom||false)} style={{background:`linear-gradient(135deg,${cfg.color}99,${cfg.color})`,color:"#000",border:"none",borderRadius:5,padding:"7px 15px",cursor:"pointer",fontFamily:"'Orbitron',monospace",fontSize:10,fontWeight:700,letterSpacing:1,boxShadow:`0 0 9px ${cfg.glow}`,flexShrink:0}}>+{TASK_XP[sel]} XP</button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    {done.length>0&&(
                      <div style={{display:"flex",flexDirection:"column",gap:6,marginBottom:12}}>
                        {done.map(task=>(
                          <div key={task.id} style={{background:"rgba(0,230,118,.03)",border:"1px solid rgba(0,230,118,.18)",borderRadius:9,padding:"11px 14px",display:"flex",alignItems:"center",gap:10,opacity:.65}}>
                            <span style={{color:"#00e676",fontSize:14}}>✓</span>
                            <div style={{flex:1,minWidth:0}}>
                              <div style={{fontSize:13,color:"#777",fontWeight:600,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{task.name}</div>
                              <div style={{fontSize:9,color:"#00e676",fontFamily:"'Share Tech Mono',monospace",marginTop:1}}>+{TASK_XP[todayDone[task.id]]} XP · {todayDone[task.id]}-RANK</div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                    <button onClick={()=>setCreateMode("task")} style={{width:"100%",background:"rgba(255,255,255,.02)",border:"1px dashed rgba(255,255,255,.1)",borderRadius:9,padding:"12px",cursor:"pointer",color:"#333",fontFamily:"'Orbitron',monospace",fontSize:10,letterSpacing:1,display:"flex",alignItems:"center",justifyContent:"center",gap:8,marginBottom:isDesktop?0:22,transition:"all .15s"}}>
                      <span style={{fontSize:15,color:"rgba(255,255,255,.15)"}}>＋</span> ADD CUSTOM TASK
                    </button>
                  </div>

                  {/* Habits column */}
                  <div style={{marginTop:isDesktop?0:0}}>
                    <div style={{fontSize:9,color:"#222",fontFamily:"'Orbitron',monospace",letterSpacing:2,marginBottom:10,marginTop:isDesktop?0:22}}>── HABITS ─────────────────</div>
                    <div style={{background:"rgba(255,214,0,.04)",border:"1px solid rgba(255,214,0,.12)",borderRadius:9,padding:"10px 13px",marginBottom:14}}>
                      <div style={{fontSize:11,color:"#ffd600",fontFamily:"'Share Tech Mono',monospace",lineHeight:1.5}}>
                        🔁 Habits can be logged as many times as you do them.
                      </div>
                    </div>
                    {habits.length===0&&(
                      <div style={{textAlign:"center",padding:"18px 0",color:"#2a2a3a",fontSize:12,fontFamily:"'Share Tech Mono',monospace",marginBottom:14}}>No habits yet.</div>
                    )}
                    {habits.length>0&&(
                      <div style={{display:"flex",flexDirection:"column",gap:9,marginBottom:14}}>
                        {habits.map(habit=>{
                          const countToday=habitCountToday(habit.id);
                          const isPopping=(habitPops[habit.id]||0)>0;
                          return (
                            <div key={habit.id} style={{background:"#0d0d1a",border:"1px solid rgba(255,214,0,.15)",borderRadius:10,padding:"14px 15px"}}>
                              <div style={{display:"flex",alignItems:"center",gap:9,marginBottom:12}}>
                                <div style={{flex:1,minWidth:0}}>
                                  <div style={{fontSize:14,color:"#ddd",fontWeight:700,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{habit.name}</div>
                                  <div style={{display:"flex",alignItems:"center",gap:7,marginTop:3}}>
                                    <span style={{fontFamily:"'Orbitron',monospace",fontSize:9,color:"#ffd600",letterSpacing:.5}}>{habit.rank}-RANK · +{TASK_XP[habit.rank]} XP</span>
                                    {countToday>0&&<span style={{fontFamily:"'Orbitron',monospace",fontSize:9,color:"#ffd600",background:"rgba(255,214,0,.12)",border:"1px solid rgba(255,214,0,.25)",borderRadius:10,padding:"2px 8px",animation:isPopping?"pop .25s":"none"}}>×{countToday} today</span>}
                                  </div>
                                </div>
                                <div style={{display:"flex",gap:6,flexShrink:0}}>
                                  <button onClick={()=>setEditTarget({...habit,currentName:habit.name})} style={{background:"transparent",border:"none",color:"#2a2a3a",cursor:"pointer",fontSize:13,padding:0,lineHeight:1}}>✏️</button>
                                  <button onClick={()=>deleteTask(habit)} style={{background:"transparent",border:"none",color:"#2a2a3a",cursor:"pointer",fontSize:13,padding:0,lineHeight:1}}>🗑</button>
                                </div>
                              </div>
                              <button className="habit-btn" onClick={()=>logHabit(habit)} style={{
                                width:"100%",
                                background:"linear-gradient(135deg,rgba(255,214,0,.15),rgba(255,214,0,.25))",
                                border:"1px solid rgba(255,214,0,.4)",
                                color:"#ffd600",borderRadius:8,padding:"12px",cursor:"pointer",
                                fontFamily:"'Orbitron',monospace",fontSize:12,fontWeight:700,letterSpacing:1,
                                boxShadow:"0 0 12px rgba(255,214,0,.15)",
                                display:"flex",alignItems:"center",justifyContent:"center",gap:9,
                                transform:isPopping?"scale(.97)":"scale(1)",
                              }}>
                                <span style={{fontSize:15}}>🔁</span>
                                LOG +{TASK_XP[habit.rank]} XP
                                {countToday>0&&<span style={{fontSize:10,opacity:.7}}>({countToday}x)</span>}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                    <button onClick={()=>setCreateMode("habit")} style={{width:"100%",background:"rgba(255,214,0,.04)",border:"1px dashed rgba(255,214,0,.2)",borderRadius:9,padding:"12px",cursor:"pointer",color:"#ffd60099",fontFamily:"'Orbitron',monospace",fontSize:10,letterSpacing:1,display:"flex",alignItems:"center",justifyContent:"center",gap:8,transition:"all .15s"}}>
                      <span style={{fontSize:15,color:"rgba(255,214,0,.2)"}}>＋</span> ADD HABIT
                    </button>
                  </div>

                </div>
              </div>
            );
          })()}

          {/* ══ SLEEP ════════════════════════════════════════════ */}
          {view==="sleep"&&(
            <div className="fade" style={{padding:isDesktop?"30px 36px 0":"18px 14px 0"}}>
              {!isDesktop&&<button onClick={()=>setView("dashboard")} style={{background:"transparent",border:"none",color:"#444",cursor:"pointer",fontSize:13,marginBottom:18,display:"flex",alignItems:"center",gap:5,fontFamily:"'Rajdhani',sans-serif"}}>← Back</button>}
              {isDesktop&&<button onClick={()=>setView("dashboard")} style={{background:"transparent",border:"1px solid rgba(255,255,255,.08)",color:"#555",cursor:"pointer",fontSize:10,marginBottom:26,display:"inline-flex",alignItems:"center",gap:7,fontFamily:"'Orbitron',monospace",letterSpacing:.5,padding:"6px 14px",borderRadius:5}}>← BACK TO DASHBOARD</button>}
              <div style={{maxWidth:isDesktop?540:"100%"}}>
                <div style={{fontFamily:"'Orbitron',monospace",fontSize:isDesktop?20:15,fontWeight:700,color:"#fff",letterSpacing:2,marginBottom:4}}>🌙 SLEEP LOG</div>
                <div style={{fontSize:10,color:"#333",fontFamily:"'Share Tech Mono',monospace",marginBottom:22}}>Adds XP to Health · resets daily</div>
                <div style={{background:"#0d0d1a",border:"1px solid rgba(255,255,255,.07)",borderRadius:11,padding:"20px",marginBottom:14}}>
                  <div style={{fontSize:10,color:"#444",fontFamily:"'Orbitron',monospace",letterSpacing:1,marginBottom:10}}>HOURS SLEPT</div>
                  <input type="number" min="0" max="24" step="0.5" value={sleepInput} onChange={e=>setSleepInput(e.target.value)} placeholder="e.g. 7.5"
                    style={{width:"100%",background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.09)",borderRadius:7,color:"#fff",padding:"14px 15px",fontFamily:"'Orbitron',monospace",fontSize:24,textAlign:"center",outline:"none"}}/>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:7,marginTop:14}}>
                    {[["8+ hrs","80 XP","#00e676"],["7-8 hrs","50 XP","#2979ff"],["6-7 hrs","25 XP","#ff8c00"],["< 6 hrs","0 XP","#2a2a3a"]].map(([label,xp,c])=>(
                      <div key={label} style={{background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.05)",borderRadius:7,padding:"9px",textAlign:"center"}}>
                        <div style={{fontFamily:"'Orbitron',monospace",fontSize:13,color:c,marginBottom:2}}>{xp}</div>
                        <div style={{fontSize:9,color:"#333",fontFamily:"'Share Tech Mono',monospace"}}>{label}</div>
                      </div>
                    ))}
                  </div>
                </div>
                <button className="pb" onClick={logSleep} style={{width:"100%",background:"linear-gradient(135deg,#2979ff99,#2979ff)",color:"#fff",border:"none",borderRadius:9,padding:"14px",cursor:"pointer",fontFamily:"'Orbitron',monospace",fontSize:12,fontWeight:700,letterSpacing:2,boxShadow:"0 0 18px rgba(41,121,255,.3)"}}>LOG SLEEP</button>
                {sleepToday&&<div style={{textAlign:"center",marginTop:12,fontSize:10,color:"#00e676",fontFamily:"'Share Tech Mono',monospace"}}>✓ Today: {sleepToday.hours}h · +{sleepToday.xp} Health XP</div>}
              </div>
            </div>
          )}

          {view==="archive"&&<Archive taskLog={state.taskLog} sleepLog={state.sleepLog} isDesktop={isDesktop}/>}
        </div>
      </div>

      {/* Mobile bottom nav */}
      {!isDesktop&&(
        <div style={{position:"fixed",bottom:0,left:0,right:0,width:"100%",background:"rgba(7,7,16,.97)",borderTop:"1px solid rgba(255,255,255,.06)",display:"flex",padding:"10px 0 14px",zIndex:100,backdropFilter:"blur(12px)"}}>
          {[{id:"dashboard",label:"HOME",icon:"◈"},{id:"sleep",label:"SLEEP",icon:"🌙"},{id:"archive",label:"LOG",icon:"📜"},{id:"__reset",label:"RESET",icon:"⚙️"}].map(n=>(
            <button key={n.id} className="nb" onClick={()=>n.id==="__reset"?setShowReset(true):setView(n.id)} style={{flex:1,background:"transparent",border:"none",cursor:"pointer",display:"flex",flexDirection:"column",alignItems:"center",gap:3,padding:"6px 0",borderRadius:5,transition:"background .14s"}}>
              <span style={{fontSize:16}}>{n.icon}</span>
              <span style={{fontFamily:"'Orbitron',monospace",fontSize:8,letterSpacing:.7,color:view===n.id&&n.id!=="__reset"?"#2979ff":n.id==="__reset"?"#333":"#2a2a3a",fontWeight:700,transition:"color .14s"}}>{n.label}</span>
              {view===n.id&&n.id!=="__reset"&&<div style={{width:16,height:2,background:"#2979ff",borderRadius:1,boxShadow:"0 0 5px #2979ff",marginTop:1}}/>}
            </button>
          ))}
        </div>
      )}
    </div>  
  </div>
  );
}
