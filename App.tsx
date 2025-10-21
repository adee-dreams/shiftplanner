
import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarDays, Palette, Settings2, Sun, Moon, Plus, Clock, X } from "lucide-react";

/** ---------- Utilities ---------- */
const fmtLong = (d: Date) => d.toLocaleDateString(undefined, { weekday: "long", year: "numeric", month: "long", day: "numeric" });
const fmtTab  = (d: Date) => d.toLocaleDateString(undefined, { month: "short", day: "numeric" }) + " " + d.toLocaleDateString(undefined, { weekday: "short" });
const ymd     = (d: Date) => d.toISOString().slice(0,10);
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate()+n); return x; };
const startOfMonth = (y: number, m: number) => new Date(y,m,1);
const endOfMonth   = (y: number, m: number) => new Date(y,m+1,0);
const isSameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

const pad = (n: number) => (n<10? "0":"") + n;
const toMinutes = (hhmm: string) => {
  if (!hhmm) return 0;
  const [h,m] = hhmm.split(":").map(Number);
  return h*60+m;
};
const fromMinutes = (min: number) => `${pad(Math.floor(min/60))}:${pad(min%60)}`;
const clamp = (v:number, min:number, max:number) => Math.max(min, Math.min(max, v));

const WORK_START = 7*60; // 07:00
const WORK_END   = 19*60; // 19:00

/** ---------- Types ---------- */
type Block = { id: string; tech: string; start: string; end: string; title?: string; shift: string; color?: string };
type DayData = { date: string; shift: string; blocks: Block[] };
type Assignments = Record<string, DayData>;

/** ---------- Local Storage helpers ---------- */
const LS = {
  assignments: "sp.assignments.v1",
  theme: "sp.theme.v1",
  palette: "sp.palette.v1",
  roster: "sp.roster.v1",
  shiftNames: "sp.shiftNames.v1"
};
const save = (k:string, v:any) => localStorage.setItem(k, JSON.stringify(v));
const load = <T,>(k:string, def:T):T => {
  try { const v = localStorage.getItem(k); return v? JSON.parse(v) as T : def; } catch { return def; }
};

/** ---------- Defaults ---------- */
const defaultShiftNames = ["Shift 1", "Shift 2", "Shift 3", "Shift 4"];
const defaultRoster: Record<string,string[]> = {
  "Shift 1": ["BRAD","VERNE","DREW","MEGAN"],
  "Shift 2": ["MIKE","CODY","ALEX"],
  "Shift 3": ["CURTIS","TRAVIS","NOLAN","JEREMY"],
  "Shift 4": ["TED","GURWINDER"]
};
const defaultPalette = ["#2563eb","#16a34a","#f59e0b","#ef4444","#7c3aed","#0ea5e9"];

/** ---------- Color utils ---------- */
const useTheme = () => {
  const [dark, setDark] = useState(load(LS.theme, false));
  useEffect(()=>{ save(LS.theme, dark); document.documentElement.classList.toggle("dark", dark); },[dark]);
  return { dark, setDark };
};

/** ---------- Modals ---------- */
function AddBlockModal({open,onClose,tech,onSave,palette}:{open:boolean;onClose:()=>void;tech:string|null;onSave:(b:Pick<Block,"start"|"end"|"title"|"color">)=>void; palette:string[]}){
  const [title,setTitle]=useState(""); const [st,setSt]=useState("08:00"); const [en,setEn]=useState("09:00");
  const [color,setColor]=useState<string>(palette[0]||"#2563eb");
  useEffect(()=>{ if(open){ setTitle(""); setSt("08:00"); setEn("09:00"); setColor(palette[0]||"#2563eb"); } },[open,palette]);
  if(!open||!tech) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-[420px] max-w-[95vw] p-5">
        <div className="flex items-center justify-between mb-3"><div className="font-semibold">New block for {tech}</div><button className="px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-slate-800" onClick={onClose}><X size={16}/></button></div>
        <div className="space-y-3">
          <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Title (optional)" className="border rounded-lg px-3 py-2 w-full bg-white dark:bg-slate-800"/>
          <div className="grid grid-cols-2 gap-3">
            <div><div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Start</div><input type="time" value={st} onChange={e=>setSt(e.target.value)} className="border rounded-lg px-3 py-2 w-full bg-white dark:bg-slate-800"/></div>
            <div><div className="text-xs text-gray-600 dark:text-gray-400 mb-1">End</div><input type="time" value={en} onChange={e=>setEn(e.target.value)} className="border rounded-lg px-3 py-2 w-full bg-white dark:bg-slate-800"/></div>
          </div>
          <div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Color</div>
            <div className="flex flex-wrap gap-2">
              {palette.map(c=>(<button key={c} onClick={()=>setColor(c)} className={`w-7 h-7 rounded-full border ${color===c? "ring-2 ring-offset-2 ring-blue-500 dark:ring-offset-slate-900":""}`} style={{background:c}}/>))}
              <input type="color" value={color} onChange={e=>setColor(e.target.value)} className="w-10 h-7 p-0 border rounded bg-white dark:bg-slate-800"/>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-slate-800">Cancel</button>
            <button onClick={()=>{onSave({start:st,end:en,title,color}); onClose();}} className="px-3 py-2 bg-blue-600 text-white rounded">Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function EditBlockModal({open,onClose,block,palette,onSave}:{open:boolean;onClose:()=>void;block:Block|null;palette:string[];onSave:(b:Partial<Block>)=>void}){
  const [title,setTitle]=useState(block?.title||""); const [st,setSt]=useState(block?.start||"08:00"); const [en,setEn]=useState(block?.end||"09:00");
  const [color,setColor]=useState<string>(block?.color||palette[0]);
  useEffect(()=>{ if(open && block){ setTitle(block.title||""); setSt(block.start); setEn(block.end); setColor(block.color||palette[0]); } },[open,block,palette]);
  if(!open || !block) return null;
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">
      <div className="bg-white dark:bg-slate-900 rounded-2xl shadow-xl w-[420px] max-w-[95vw] p-5">
        <div className="flex items-center justify-between mb-3"><div className="font-semibold">Edit block</div><button className="px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-slate-800" onClick={onClose}><X size={16}/></button></div>
        <div className="space-y-3">
          <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="Title (optional)" className="border rounded-lg px-3 py-2 w-full bg-white dark:bg-slate-800"/>
          <div className="grid grid-cols-2 gap-3">
            <div><div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Start</div><input type="time" value={st} onChange={e=>setSt(e.target.value)} className="border rounded-lg px-3 py-2 w-full bg-white dark:bg-slate-800"/></div>
            <div><div className="text-xs text-gray-600 dark:text-gray-400 mb-1">End</div><input type="time" value={en} onChange={e=>setEn(e.target.value)} className="border rounded-lg px-3 py-2 w-full bg-white dark:bg-slate-800"/></div>
          </div>
          <div>
            <div className="text-xs text-gray-600 dark:text-gray-400 mb-1">Color</div>
            <div className="flex flex-wrap gap-2">
              {palette.map(c=>(<button key={c} onClick={()=>setColor(c)} className={`w-7 h-7 rounded-full border ${color===c? "ring-2 ring-offset-2 ring-blue-500 dark:ring-offset-slate-900":""}`} style={{background:c}}/>))}
              <input type="color" value={color} onChange={e=>setColor(e.target.value)} className="w-10 h-7 p-0 border rounded bg-white dark:bg-slate-800"/>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <button onClick={onClose} className="px-3 py-2 rounded hover:bg-gray-100 dark:hover:bg-slate-800">Cancel</button>
            <button onClick={()=>{ onSave({title,start:st,end:en,color}); onClose(); }} className="px-3 py-2 bg-blue-600 text-white rounded">Save</button>
          </div>
        </div>
      </div>
    </div>
  );
}

/** ---------- Day Editor ---------- */
function DayEditor({date, roster, assignments, setAssignments, shift, palette}:{date:Date; roster:string[]; assignments:Assignments; setAssignments:(u:Assignments)=>void; shift:string; palette:string[]}){
  const key = ymd(date);
  const [addForTech, setAddForTech] = useState<string|null>(null);
  const [editBlock, setEditBlock]   = useState<Block|null>(null);

  const data = assignments[key] || { date: key, shift, blocks: [] };

  useEffect(()=>{
    if(!assignments[key]) {
      const n = {...assignments, [key]: data};
      setAssignments(n); save(LS.assignments, n);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hours = Array.from({length:(WORK_END-WORK_START)/60+1}).map((_,i)=> fromMinutes(WORK_START + i*60));

  const saveBlock = (tech: string, base:{start:string;end:string;title?:string;color?:string}) => {
    const id = Math.random().toString(36).slice(2);
    const rec = assignments[key] || { date:key, shift, blocks: [] };
    rec.blocks = [...(rec.blocks||[]), { id, tech, shift, ...base }];
    const n = {...assignments, [key]: rec}; setAssignments(n); save(LS.assignments, n);
  };

  const removeBlock = (id:string) => {
    const rec = assignments[key]; if(!rec) return;
    rec.blocks = (rec.blocks||[]).filter(b=>b.id!==id);
    const n = {...assignments, [key]: rec}; setAssignments(n); save(LS.assignments, n);
  };

  const blocksByTech = useMemo(()=>{
    const by: Record<string, Block[]> = {};
    (assignments[key]?.blocks||[]).forEach(b=> { if(b.shift===shift) { (by[b.tech] ||= []).push(b); } });
    return by;
  },[assignments,key,shift]);

  const lanesRef = useRef<HTMLDivElement>(null);

  const onLaneDrag = (tech:string, e:React.MouseEvent<HTMLDivElement>) => {
    const el = lanesRef.current; if(!el) return;
    const rect = el.getBoundingClientRect();
    const x0 = e.clientX - rect.left;
    const startMin = Math.round((x0 / rect.width) * (WORK_END-WORK_START) / 15) * 15 + WORK_START;
    const st = fromMinutes(clamp(startMin, WORK_START, WORK_END-15));
    setAddForTech(tech);
  };

  return (
    <div className="space-y-6">
      {/* time axis */}
      <div className="hidden md:flex text-xs text-gray-500 dark:text-gray-400 gap-6 pl-48">
        {hours.map((h)=> (<div key={h} style={{width:`${100/hours.length}%`}} className="text-center">{h}</div>))}
      </div>

      {/* lanes */}
      <div className="space-y-4">
        {roster.map(tech => {
          const techBlocks = blocksByTech[tech] || [];
          return (
            <div key={tech} className="rounded-2xl border bg-white dark:bg-slate-800 overflow-hidden">
              <div className="px-4 py-2 font-semibold">{tech}</div>
              <div ref={lanesRef} className="relative h-20 mx-2 mb-3 rounded-xl bg-slate-100 dark:bg-slate-900 cursor-crosshair"
                   onDoubleClick={(e)=> onLaneDrag(tech, e)}>
                {/* hour grid */}
                <div className="absolute inset-0 grid" style={{gridTemplateColumns:`repeat(${hours.length-1},1fr)`}}>
                  {hours.slice(0,-1).map((_,i)=>(<div key={i} className="border-r border-slate-200/70 dark:border-slate-700/60"></div>))}
                </div>

                {/* blocks */}
                <AnimatePresence>
                {techBlocks.map(b=>{
                  const left = ((toMinutes(b.start)-WORK_START)/(WORK_END-WORK_START))*100;
                  const width = ((toMinutes(b.end)-toMinutes(b.start))/(WORK_END-WORK_START))*100;
                  return (
                    <motion.div key={b.id} initial={{opacity:0,y:6}} animate={{opacity:1,y:0}} exit={{opacity:0,y:-6}}
                      onClick={(e)=>{e.stopPropagation(); setEditBlock(b);}}
                      className="absolute rounded-xl text-xs text-white px-2 py-1 flex items-center gap-2 shadow"
                      style={{left:`${left}%`, width:`${width}%`, top:8, height:40, background:(b.color || "#2563eb")}}>
                      <Clock size={12}/> {b.start}-{b.end} {b.title? `• ${b.title}`: ""}
                      <button className="ml-auto opacity-80 hover:opacity-100" onClick={(e)=>{e.stopPropagation(); removeBlock(b.id);}}><X size={12}/></button>
                    </motion.div>
                  );
                })}
                </AnimatePresence>

                <button onClick={()=>setAddForTech(tech)} className="absolute right-2 top-2 rounded-full bg-slate-200 dark:bg-slate-700 w-7 h-7 flex items-center justify-center hover:bg-slate-300 dark:hover:bg-slate-600"><Plus size={14}/></button>
              </div>
            </div>
          );
        })}
      </div>

      <AddBlockModal open={!!addForTech} onClose={()=>setAddForTech(null)} tech={addForTech} palette={palette}
         onSave={(v)=> saveBlock(addForTech!, v)} />
      <EditBlockModal open={!!editBlock} onClose={()=>setEditBlock(null)} block={editBlock} palette={palette}
         onSave={(vals)=>{
           const rec = assignments[key]; if(!rec || !editBlock) return;
           rec.blocks = rec.blocks.map(b=> b.id===editBlock.id? {...b, ...vals}: b);
           const n = {...assignments, [key]: rec}; setAssignments(n); save(LS.assignments, n);
         }} />
    </div>
  );
}

/** ---------- App ---------- */
export default function App(){
  const today = new Date();
  const [current, setCurrent] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const { dark, setDark } = useTheme();
  const [palette, setPalette] = useState<string[]>(load(LS.palette, defaultPalette));
  const [shiftNames, setShiftNames] = useState<string[]>(load(LS.shiftNames, defaultShiftNames));
  const [selectedShift, setSelectedShift] = useState(shiftNames[0]);
  const [roster, setRoster] = useState<Record<string,string[]>>(load(LS.roster, defaultRoster));
  const [assignments, setAssignments] = useState<Assignments>(load(LS.assignments, {}));
  const [zoom, setZoom] = useState(1);

  useEffect(()=> save(LS.palette, palette), [palette]);
  useEffect(()=> save(LS.roster, roster), [roster]);
  useEffect(()=> save(LS.shiftNames, shiftNames), [shiftNames]);

  const days = useMemo(()=>{
    const y = current.getFullYear(); const m = current.getMonth();
    const first = startOfMonth(y,m); const last = endOfMonth(y,m);
    const result: Date[] = [];
    const startPad = first.getDay(); // 0=Sun
    for(let i=0;i<startPad;i++) result.push(addDays(first, i-startPad));
    for(let d=1; d<=last.getDate(); d++) result.push(new Date(y,m,d));
    while(result.length%7!==0) result.push(addDays(last, result.length - (startPad + last.getDate()) + 1));
    return result;
  },[current]);

  const [activeDay, setActiveDay] = useState<Date>(today);

  useEffect(()=>{
    // keep activeDay in this month
    const y = current.getFullYear(); const m = current.getMonth();
    if(activeDay.getMonth()!==m || activeDay.getFullYear()!==y){
      setActiveDay(new Date(y,m,1));
    }
  },[current]); // eslint-disable-line

  const header = (
    <div className="flex items-center gap-3 justify-between">
      <div className="flex items-center gap-2 text-2xl font-bold"><CalendarDays className="w-7 h-7"/><span>Shift Planner</span></div>
      <div className="flex items-center gap-2">
        <button className="px-3 py-2 rounded-xl border bg-white dark:bg-slate-800 flex items-center gap-2" onClick={()=>setDark(!dark)}>
          {dark? <Sun size={16}/> : <Moon size={16}/>}{dark? "Light" : "Dark"} theme
        </button>
        <div className="px-3 py-2 rounded-xl border bg-white dark:bg-slate-800 flex items-center gap-2">
          <Palette size={16}/> Palette
          <div className="flex gap-1 ml-2">
            {palette.map((c,i)=>(<button key={i} onClick={()=>{
              const rotated = [...palette.slice(i), ...palette.slice(0,i)];
              setPalette(rotated);
            }} className="w-5 h-5 rounded-full border" style={{background:c}}/>))}
          </div>
        </div>
        <div className="px-3 py-2 rounded-xl border bg-white dark:bg-slate-800 flex items-center gap-2">
          <Settings2 size={16}/> Zoom
          <input type="range" min={0.8} max={1.4} step={0.05} value={zoom} onChange={e=>setZoom(parseFloat(e.target.value))} />
        </div>
      </div>
    </div>
  );

  const monthLabel = current.toLocaleDateString(undefined, {month:"long", year:"numeric"});

  return (
    <div className={`min-h-full ${dark? "dark bg-slate-950 text-slate-100":"bg-slate-50 text-slate-900"}`} style={{fontFamily:"ui-sans-serif, system-ui"}}>
      <div className="max-w-6xl mx-auto p-4 space-y-6" style={{zoom}}>
        {header}

        <div className="flex items-center gap-4 mt-2">
          <button className="px-2 py-1 rounded-xl border bg-white dark:bg-slate-800" onClick={()=> setCurrent(addDays(current, -30))}>◀</button>
          <div className="text-xl font-semibold">{monthLabel}</div>
          <button className="px-2 py-1 rounded-xl border bg-white dark:bg-slate-800" onClick={()=> setCurrent(addDays(current, 30))}>▶</button>
        </div>

        {/* calendar grid and day editor */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
          {/* calendar */}
          <div className="md:col-span-4">
            <div className="grid grid-cols-7 gap-2 text-center text-xs text-gray-500 dark:text-gray-400 mb-2">
              {["Sun","Mon","Tue","Wed","Thu","Fri","Sat"].map(d=>(<div key={d}>{d}</div>))}
            </div>
            <div className="grid grid-cols-7 gap-2">
              {days.map((d,idx)=>{
                const inMonth = d.getMonth()===current.getMonth();
                const active = isSameDay(d, activeDay);
                const isSunday = d.getDay()===0;
                return (
                  <button key={idx} onClick={()=> setActiveDay(d)}
                    className={`h-16 rounded-2xl border flex flex-col items-center justify-center ${active? "ring-2 ring-blue-500":""} ${inMonth? "bg-white dark:bg-slate-800":"bg-slate-100 dark:bg-slate-900"} ${isSunday? "text-red-600 dark:text-red-400":""}`}>
                    <div className="text-lg font-semibold">{d.getDate()}</div>
                    <div className="text-[10px]">{fmtTab(d).split(" ")[1]}</div>
                  </button>
                )
              })}
            </div>
          </div>

          {/* day editor */}
          <div className="md:col-span-8 space-y-4">
            <div className="text-2xl font-semibold">{fmtLong(activeDay)} <span className="text-sm text-gray-500 dark:text-gray-400">({fmtTab(activeDay)})</span></div>

            <div className="flex gap-2">
              {shiftNames.map(name => (
                <button key={name} onClick={()=> setSelectedShift(name)}
                  className={`px-3 py-1 rounded-full border ${selectedShift===name? "bg-blue-600 text-white":"bg-white dark:bg-slate-800"}`}>{name}</button>
              ))}
              <span className="text-sm text-gray-500 dark:text-gray-400 ml-2">{roster[selectedShift]?.length||0} tech(s)</span>
            </div>

            <DayEditor date={activeDay} roster={roster[selectedShift]||[]} assignments={assignments} setAssignments={setAssignments} shift={selectedShift} palette={palette}/>
          </div>
        </div>
      </div>
    </div>
  );
}
