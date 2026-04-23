import { useState, useEffect, useRef } from "react";

const XP_THRESHOLDS = [0,200,500,1000,1800,2800,4200,6000,8500,12000];
const STAT_TITLES   = ["Initiate","Apprentice","Warrior","Elite","Champion","Master","Grandmaster","Legend","Mythic","Transcendent"];
const CHAR_TITLES   = ["Civilian","Awakened","Hunter","Ranked Fighter","Elite Operative","Shadow Walker","Dungeon Breaker","Monarch","Transcendent","Absolute"];
const CHAR_ICONS    = ["👤","🌀","🗡️","⚔️","🔱","🌑","🏯","👑","✨","🌌"];
const TASK_XP       = {E:10,B:25,S:50};
const GRACE_DAYS    = 3;
const DECAY         = 20;
const WILL_DECAY    = 30;

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
  if(total>=8) return 60; if(total>=6) return 35; if(total>=4) return 15; return 0;
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
  taskLog:[],       // {date,taskId,taskName,stat,rank,xp,isCustom,isHabit}
  sleepLog:[],
  customTasks:[],   // {id,stat,name,rank,isCustom:true}
  habits:[],        // {id,stat,name,rank,isHabit:true}
  hiddenTasks:[],
  taskNameOverrides:{}, // {taskId: newName}
  lastDecayCheck:null,
});

// ── STYLES ───────────────────────────────────────────────────────────────────
const injectStyles = () => {
  if(document.getElementById("rpg-css")) return;
  const s=document.createElement("style"); s.id="rpg-css";
  s.textContent=`
    @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;600;700&family=Orbitron:wght@400;700;900&family=Share+Tech+Mono&display=swap');
    .rpg,.rpg*{box-sizing:border-box;} .rpg{font-family:'Rajdhani',sans-serif;}
    @keyframes fadeIn  {from{opacity:0;transform:translateY(5px)}to{opacity:1;transform:none}}
    @keyframes slideUp {from{opacity:0;transform:translateY(24px)}to{opacity:1;transform:none}}
    @keyframes scan    {0%{top:-5%}100%{top:105%}}
    @keyframes pulse   {0%,100%{opacity:.4}50%{opacity:1}}
    @keyframes bpulse  {0%,100%{border-color:rgba(41,121,255,.25)}50%{border-color:rgba(41,121,255,.6)}}
    @keyframes lvlUp   {0%{opacity:0;transform:scale(.7)}20%{opacity:1;transform:scale(1.08)}80%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(1.04)}}
    @keyframes shimmer {0%{background-position:-200% center}100%{background-position:200% center}}
    @keyframes float   {0%,100%{transform:translateY(0)}50%{transform:translateY(-4px)}}
    @keyframes popIn   {0%{transform:scale(.8);opacity:0}60%{transform:scale(1.15)}100%{transform:scale(1);opacity:1}}
    .fade  {animation:fadeIn .22s ease both;}
    .slide {animation:slideUp .28s cubic-bezier(.2,.8,.2,1) both;}
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
    .habit-btn{transition:all .15s;active:scale(.95);}
    .habit-btn:hover{filter:brightness(1.2);}
    ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-track{background:#070710}::-webkit-scrollbar-thumb{background:#1a1a2e;border-radius:2px}
  `;
  document.head.appendChild(s);
};

// ── SHARED ───────────────────────────────────────────────────────────────────
const RP = ({rank,sel,onClick}) => {
  const c={E:"#666",B:"#00bcd4",S:"#ffd600"}[rank];
  return <button className="rp" onClick={onClick} style={{background:sel?c:"transparent",color:sel?"#000":c,border:`1px solid ${c}`,borderRadius:3,padding:"2px 8px",fontSize:10,fontFamily:"'Orbitron',monospace",fontWeight:700,opacity:sel?1:.42,letterSpacing:1}}>{rank}</button>;
};

const XPBar = ({xp,color,glow,thin}) => {
  const {pct,cur,need}=getLevelProgress(xp);
  return (
    <div>
      <div style={{height:thin?3:5,background:"rgba(255,255,255,.05)",borderRadius:3,overflow:"hidden"}}>
        <div style={{width:`${pct}%`,height:"100%",background:`linear-gradient(90deg,${color}77,${color})`,boxShadow:`0 0 7px ${glow}`,borderRadius:3,transition:"width .6s cubic-bezier(.4,0,.2,1)"}}/>
      </div>
      {!thin&&<div style={{display:"flex",justifyContent:"space-between",marginTop:3,fontSize:9,color:"#3a3a4a",fontFamily:"'Share Tech Mono',monospace"}}><span>{cur}/{need} XP</span><span>{pct}%</span></div>}
    </div>
  );
};

// ── LEVEL TABLE ──────────────────────────────────────────────────────────────
const LevelTable = ({currentXP,color,glow,statName,onClose}) => {
  const curLvl=getLevel(currentXP);
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.88)",zIndex:400,display:"flex",alignItems:"center",justifyContent:"center",padding:"20px"}}>
      <div className="slide" onClick={e=>e.stopPropagation()} style={{background:"#0a0a14",border:`1px solid ${color}44`,borderRadius:12,padding:"22px 18px",width:"100%",maxWidth:360,maxHeight:"80vh",overflow:"auto",boxShadow:`0 0 40px ${glow}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
          <div>
            <div style={{fontFamily:"'Orbitron',monospace",fontSize:12,fontWeight:700,color:"#fff",letterSpacing:1}}>RANK PROGRESSION</div>
            <div style={{fontSize:10,color,marginTop:2}}>{statName}</div>
          </div>
          <button onClick={onClose} style={{background:"transparent",border:"none",color:"#444",fontSize:18,cursor:"pointer"}}>✕</button>
        </div>
        <div style={{display:"flex",flexDirection:"column",gap:6}}>
          {STAT_TITLES.map((title,i)=>{
            const lvl=i+1,reached=curLvl>=lvl,isCur=curLvl===lvl;
            return (
              <div key={i} style={{background:isCur?`${color}18`:reached?"rgba(255,255,255,.03)":"transparent",border:`1px solid ${isCur?color:reached?"rgba(255,255,255,.08)":"rgba(255,255,255,.03)"}`,borderRadius:8,padding:"10px 12px",position:"relative",overflow:"hidden",boxShadow:isCur?`0 0 14px ${glow}`:""}}>
                {isCur&&<div style={{position:"absolute",left:0,top:0,bottom:0,width:3,background:color}}/>}
                <div style={{display:"flex",alignItems:"center",gap:10}}>
                  <div style={{fontFamily:"'Orbitron',monospace",fontSize:18,fontWeight:900,color:reached?color:"#222",minWidth:28,textAlign:"center"}}>{lvl}</div>
                  <div style={{flex:1}}>
                    <div style={{fontSize:13,fontWeight:700,color:isCur?"#fff":reached?"#aaa":"#333"}}>{title}</div>
                    <div style={{fontSize:9,color:"#444",fontFamily:"'Share Tech Mono',monospace",marginTop:2}}>{XP_THRESHOLDS[i]} XP{XP_THRESHOLDS[i+1]?` → ${XP_THRESHOLDS[i+1]} XP`:""}</div>
                  </div>
                  <div style={{fontSize:14}}>{reached?(isCur?"📍":"✓"):"🔒"}</div>
                </div>
                {isCur&&<div style={{marginTop:8}}><div style={{height:3,background:"rgba(255,255,255,.05)",borderRadius:2,overflow:"hidden"}}><div style={{width:`${getLevelProgress(currentXP).pct}%`,height:"100%",background:color,borderRadius:2}}/></div></div>}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

// ── STAT DETAIL ──────────────────────────────────────────────────────────────
const StatDetail = ({sk,state,onClose,onLevelTable}) => {
  const cfg=STAT_CONFIG[sk],xp=state.statXP[sk],lvl=getLevel(xp);
  const ds=decayStatus(sk,state.lastActivity);
  const days7=Array.from({length:7},(_,i)=>{
    const d=daysAgo(6-i);
    const tasks=(state.taskLog||[]).filter(t=>t.date===d&&t.stat===sk);
    return {d,xpEarned:tasks.reduce((s,t)=>s+t.xp,0)};
  });
  const maxXP=Math.max(...days7.map(d=>d.xpEarned),1);
  return (
    <div onClick={onClose} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.88)",zIndex:400,display:"flex",alignItems:"flex-end",justifyContent:"center"}}>
      <div className="slide" onClick={e=>e.stopPropagation()} style={{background:"#0a0a14",border:`1px solid ${cfg.color}44`,borderRadius:"14px 14px 0 0",padding:"22px 20px 36px",width:"100%",maxWidth:480,maxHeight:"85vh",overflow:"auto",boxShadow:`0 -10px 40px ${cfg.glow}`}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div style={{display:"flex",alignItems:"center",gap:10}}>
            <span style={{fontSize:24}}>{cfg.icon}</span>
            <div>
              <div style={{fontFamily:"'Orbitron',monospace",fontSize:14,fontWeight:700,color:"#fff",letterSpacing:1}}>{cfg.name.toUpperCase()}</div>
              <button onClick={()=>{onClose();onLevelTable();}} style={{fontFamily:"'Orbitron',monospace",fontSize:9,color:cfg.color,background:"transparent",border:"none",cursor:"pointer",padding:0,textDecoration:"underline",textDecorationStyle:"dotted"}}>LVL {lvl} · {STAT_TITLES[lvl-1]} ↗</button>
            </div>
          </div>
          <button onClick={onClose} style={{background:"transparent",border:"none",color:"#444",fontSize:18,cursor:"pointer"}}>✕</button>
        </div>
        <div style={{marginBottom:16}}><XPBar xp={xp} color={cfg.color} glow={cfg.glow} thin={false}/></div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8,marginBottom:20}}>
          {[["TOTAL XP",xp,cfg.color],["LEVEL",lvl,"#ffd600"],["DECAY",ds.status==="safe"?`${ds.daysLeft}d safe`:ds.status==="warn"?"TOMORROW":"ACTIVE",ds.status==="safe"?"#00e676":ds.status==="warn"?"#ff8c00":"#ff1744"]].map(([l,v,c])=>(
            <div key={l} style={{background:"rgba(255,255,255,.03)",border:"1px solid rgba(255,255,255,.06)",borderRadius:7,padding:"10px 8px",textAlign:"center"}}>
              <div style={{fontFamily:"'Orbitron',monospace",fontSize:14,fontWeight:700,color:c}}>{v}</div>
              <div style={{fontSize:8,color:"#444",fontFamily:"'Share Tech Mono',monospace",marginTop:2}}>{l}</div>
            </div>
          ))}
        </div>
        <div style={{marginBottom:16}}>
          <div style={{fontSize:8,color:"#333",fontFamily:"'Orbitron',monospace",letterSpacing:1.5,marginBottom:10}}>── LAST 7 DAYS ────────────</div>
          <div style={{display:"flex",gap:4,alignItems:"flex-end",height:60}}>
            {days7.map(({d,xpEarned},i)=>{
              const h=xpEarned>0?Math.max(8,Math.floor((xpEarned/maxXP)*52)):4;
              const isToday=d===todayStr();
              return (
                <div key={i} style={{flex:1,display:"flex",flexDirection:"column",alignItems:"center",gap:3}}>
                  <div style={{width:"100%",height:h,background:xpEarned>0?cfg.color:"rgba(255,255,255,.06)",borderRadius:"3px 3px 0 0",boxShadow:xpEarned>0?`0 0 8px ${cfg.glow}`:"none",border:isToday?`1px solid ${cfg.color}`:"none"}}/>
                  <div style={{fontSize:7,color:isToday?cfg.color:"#333",fontFamily:"'Share Tech Mono',monospace"}}>{new Date(d+"T12:00:00").toLocaleDateString("en-US",{weekday:"short"}).slice(0,2)}</div>
                  {xpEarned>0&&<div style={{fontSize:7,color:cfg.color,fontFamily:"'Orbitron',monospace"}}>+{xpEarned}</div>}
                </div>
              );
            })}
          </div>
        </div>
        <div style={{background:"rgba(255,255,255,.02)",border:"1px solid rgba(255,255,255,.06)",borderRadius:8,padding:"10px 12px"}}>
          <div style={{fontSize:9,color:"#444",fontFamily:"'Orbitron',monospace",letterSpacing:1,marginBottom:6}}>STATUS</div>
          <div style={{fontSize:12,color:"#bbb"}}>Last session: <span style={{color:"#fff",fontWeight:700}}>{state.lastActivity[sk]?`${daysSince(state.lastActivity[sk])}d ago`:"Never"}</span></div>
          {ds.status==="safe"&&<div style={{fontSize:11,color:"#00e676",marginTop:4}}>✓ Safe for {ds.daysLeft} more day{ds.daysLeft!==1?"s":""}</div>}
          {ds.status==="warn"&&<div style={{fontSize:11,color:"#ff8c00",marginTop:4}}>⚠ Decay begins tomorrow</div>}
          {ds.status==="decay"&&<div style={{fontSize:11,color:"#ff1744",marginTop:4}}>▼ Decaying {ds.daysOver} day{ds.daysOver!==1?"s":""} — -{ds.daysOver*DECAY} XP lost</div>}
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
        <div style={{fontSize:48,marginBottom:12,animation:"float 1s ease-in-out infinite"}}>{cfg.icon}</div>
        <div style={{fontFamily:"'Orbitron',monospace",fontSize:11,color:cfg.color,letterSpacing:4,marginBottom:8}}>── RANK UP ──</div>
        <div style={{fontFamily:"'Orbitron',monospace",fontSize:28,fontWeight:900,marginBottom:6,color:"#fff",textShadow:`0 0 30px ${cfg.color}`}}>{cfg.name.toUpperCase()}</div>
        <div className="shimmer" style={{fontFamily:"'Orbitron',monospace",fontSize:20,fontWeight:700,marginBottom:16}}>{STAT_TITLES[newLevel-1].toUpperCase()}</div>
        <div style={{fontFamily:"'Share Tech Mono',monospace",fontSize:12,color:"#555",fontStyle:"italic",maxWidth:260,margin:"0 auto",lineHeight:1.6}}>"{getRand("levelUp")}"</div>
        <div style={{marginTop:20,fontFamily:"'Orbitron',monospace",fontSize:11,color:cfg.color}}>LEVEL {newLevel}</div>
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
    <div style={