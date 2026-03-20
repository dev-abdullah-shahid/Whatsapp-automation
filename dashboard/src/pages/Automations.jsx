import { useEffect, useState } from 'react';
import { getAutomations, createAutomation } from '../api';

const TRIG = {
  NEW_LEAD:    { label:'New lead',    color:'#6366f1', bg:'#eef2ff', border:'#c7d2fe', desc:'Fires when a new contact messages in' },
  NO_REPLY:    { label:'No reply',    color:'#f59e0b', bg:'#fffbeb', border:'#fde68a', desc:'Fires 1 hr after no reply from lead'  },
  TAG_CHANGED: { label:'Tag changed', color:'#a855f7', bg:'#f5f3ff', border:'#ddd6fe', desc:'Fires when lead tag is updated'        },
  MANUAL:      { label:'Manual',      color:'#6b7280', bg:'#f9fafb', border:'#e5e7eb', desc:'Triggered manually from lead profile'  },
};

function StepRow({ step, index, total, onChange, onRemove }) {
  return (
    <div style={{ display:'flex', gap:12, marginBottom:12 }}>
      <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:0, flexShrink:0 }}>
        <div style={{ width:22, height:22, borderRadius:99, background:'var(--text)', color:'white', display:'flex', alignItems:'center', justifyContent:'center', fontSize:9, fontWeight:700 }}>
          {index+1}
        </div>
        {index<total-1 && <div style={{ flex:1, width:1, background:'var(--border2)', minHeight:20 }}/>}
      </div>
      <div style={{ flex:1, background:'var(--bg2)', border:'1px solid var(--border)', borderRadius:'var(--r2)', padding:'13px', marginBottom: index<total-1 ? 0 : 0 }}>
        <textarea rows={2} value={step.message} onChange={e=>onChange('message',e.target.value)} placeholder={`Step ${index+1} message — use {name} for personalization`} style={{ marginBottom:10, resize:'none', fontSize:13 }}/>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between' }}>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <span style={{ fontSize:12, color:'var(--text3)' }}>Delay:</span>
            <input type="number" min="1" value={step.delayMinutes} onChange={e=>onChange('delayMinutes',parseInt(e.target.value)||1)} style={{ width:68, textAlign:'center', padding:'4px 8px', fontSize:12 }}/>
            <span style={{ fontSize:12, color:'var(--text3)' }}>min {step.delayMinutes>=60&&`(${Math.round(step.delayMinutes/6)/10}h)`}</span>
          </div>
          {total>1 && <button onClick={onRemove} className="btn btn-xs" style={{ color:'var(--red)', background:'transparent', border:'none', fontSize:11 }}>Remove step</button>}
        </div>
      </div>
    </div>
  );
}

function CreateModal({ onClose, onDone }) {
  const [name,    setName]    = useState('');
  const [trigger, setTrigger] = useState('NEW_LEAD');
  const [steps,   setSteps]   = useState([{message:'',delayMinutes:60}]);
  const [busy,    setBusy]    = useState(false);
  const [err,     setErr]     = useState('');

  const addStep    = () => setSteps(s=>[...s,{message:'',delayMinutes:60}]);
  const removeStep = i  => setSteps(s=>s.filter((_,idx)=>idx!==i));
  const updateStep = (i,k,v) => setSteps(s=>s.map((st,idx)=>idx===i?{...st,[k]:v}:st));

  const submit = async () => {
    if (!name.trim()) { setErr('Name is required.'); return; }
    if (steps.some(s=>!s.message.trim())) { setErr('All steps need a message.'); return; }
    setBusy(true);
    try { await createAutomation({name,trigger,steps}); onDone(); onClose(); }
    catch(e) { setErr(e.message); setBusy(false); }
  };

  return (
    <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ maxWidth:560 }}>
        <div className="modal-header">
          <div>
            <div style={{ fontWeight:600, fontSize:15, letterSpacing:'-0.02em' }}>New automation</div>
            <div style={{ fontSize:12, color:'var(--text3)', marginTop:2 }}>Build an automated multi-step sequence</div>
          </div>
          <button onClick={onClose} className="btn btn-ghost btn-icon" style={{ fontSize:16, color:'var(--text3)' }}>✕</button>
        </div>
        <div className="modal-body" style={{ display:'flex', flexDirection:'column', gap:18 }}>
          <div>
            <label className="label">Automation name</label>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Welcome new leads"/>
          </div>
          <div>
            <label className="label">Trigger event</label>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:8 }}>
              {Object.entries(TRIG).map(([key,m])=>(
                <button key={key} onClick={()=>setTrigger(key)} style={{
                  textAlign:'left', padding:'11px 13px', borderRadius:'var(--r2)',
                  border:`1px solid ${trigger===key?m.border:'var(--border)'}`,
                  background:trigger===key?m.bg:'var(--surface)',
                  cursor:'pointer', transition:'all 0.12s',
                }}>
                  <div style={{ fontSize:12, fontWeight:600, color:trigger===key?m.color:'var(--text)', marginBottom:3 }}>{m.label}</div>
                  <div style={{ fontSize:11, color:'var(--text3)', lineHeight:1.4 }}>{m.desc}</div>
                </button>
              ))}
            </div>
          </div>
          <div>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:10 }}>
              <label className="label" style={{ margin:0 }}>Steps ({steps.length})</label>
              <button onClick={addStep} className="btn btn-ghost btn-xs">+ Add step</button>
            </div>
            {steps.map((step,i)=>(
              <StepRow key={i} step={step} index={i} total={steps.length} onChange={(k,v)=>updateStep(i,k,v)} onRemove={()=>removeStep(i)}/>
            ))}
          </div>
          {err && <div style={{ fontSize:12, color:'var(--red)', background:'var(--red-lt)', border:'1px solid var(--red-border)', padding:'9px 13px', borderRadius:'var(--r2)' }}>{err}</div>}
        </div>
        <div className="modal-footer">
          <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
            <button onClick={onClose} className="btn btn-ghost">Cancel</button>
            <button onClick={submit} className="btn btn-primary" disabled={busy}>{busy?'Creating...':'Create automation'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Automations() {
  const [autos,  setAutos]  = useState([]);
  const [loading,setL]      = useState(true);
  const [create, setCreate] = useState(false);

  const load = ()=>{ setL(true); getAutomations().then(r=>setAutos(r.data.data)).catch(()=>{}).finally(()=>setL(false)); };
  useEffect(()=>{ load(); },[]);

  return (
    <div>
      <div className="fade-up" style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:22 }}>
        <div>
          <h2 style={{ fontFamily:'var(--font)', fontSize:22, fontWeight:400, fontStyle:'italic', letterSpacing:'-0.02em', marginBottom:3 }}>Automations</h2>
          <p style={{ fontSize:12, color:'var(--text3)' }}>{autos.length} sequences · {autos.filter(a=>a.status==='ACTIVE').length} active</p>
        </div>
        <button className="btn btn-primary" onClick={()=>setCreate(true)}>+ New automation</button>
      </div>

      {loading ? <div className="spinner"/> : autos.length===0 ? (
        <div className="card empty">
          <div style={{ width:48, height:48, borderRadius:12, background:'var(--bg2)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:14 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="#a855f7" strokeWidth="1.5" strokeLinecap="round"/>
              <circle cx="12" cy="12" r="3" stroke="#a855f7" strokeWidth="1.5"/>
            </svg>
          </div>
          <div style={{ fontWeight:600, fontSize:14, marginBottom:6 }}>No automations yet</div>
          <div style={{ fontSize:13, color:'var(--text3)', marginBottom:20 }}>Set up follow-up sequences that run on autopilot</div>
          <button className="btn btn-primary" onClick={()=>setCreate(true)}>+ Create automation</button>
        </div>
      ) : (
        <div className="card-flat fade-up" style={{ animationDelay:'80ms', overflow:'hidden' }}>
          <table>
            <thead>
              <tr>
                <th style={{ paddingLeft:20 }}>Automation</th>
                <th>Trigger</th>
                <th>Steps</th>
                <th>Status</th>
                <th>Enrolled</th>
                <th>Created</th>
              </tr>
            </thead>
            <tbody>
              {autos.map((a,i)=>{
                const tm   = TRIG[a.trigger]||TRIG.MANUAL;
                const steps= Array.isArray(a.steps)?a.steps:[];
                const active= a.status==='ACTIVE';
                return (
                  <tr key={a.id} className="fade-in" style={{ animationDelay:`${i*30}ms` }}>
                    <td style={{ paddingLeft:20 }}>
                      <div style={{ fontWeight:500, fontSize:13 }}>{a.name}</div>
                      <div style={{ fontSize:11, color:'var(--text3)', marginTop:2 }}>
                        {steps.map((s,si)=>`Step ${si+1}: ${s.delayMinutes}min`).join(' → ')}
                      </div>
                    </td>
                    <td>
                      <span style={{ padding:'3px 9px', borderRadius:99, fontSize:11, fontWeight:600, background:tm.bg, color:tm.color, border:`1px solid ${tm.border}` }}>
                        {tm.label}
                      </span>
                    </td>
                    <td>
                      <div style={{ display:'flex', gap:4 }}>
                        {steps.map((_,si)=>(
                          <div key={si} style={{ width:22, height:22, borderRadius:99, background:'var(--bg2)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'var(--text2)' }}>
                            {si+1}
                          </div>
                        ))}
                        {steps.length===0 && <span style={{ fontSize:12, color:'var(--text4)' }}>—</span>}
                      </div>
                    </td>
                    <td>
                      <span style={{ padding:'3px 9px', borderRadius:99, fontSize:11, fontWeight:600, background:active?'var(--green-bg)':'var(--bg2)', color:active?'var(--green)':'var(--text3)', border:`1px solid ${active?'#bbf7d0':'var(--border)'}` }}>
                        {active?'Active':a.status}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontFamily:'var(--font)', fontSize:16, color:'var(--text)' }}>{a._count?.enrollments||0}</span>
                    </td>
                    <td>
                      <span style={{ fontSize:11, color:'var(--text3)' }}>{new Date(a.createdAt||Date.now()).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {create && <CreateModal onClose={()=>setCreate(false)} onDone={load}/>}
    </div>
  );
}