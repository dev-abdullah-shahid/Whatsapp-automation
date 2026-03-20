import { useEffect, useState, useCallback, useRef } from 'react';
import { getLeads, updateLead, getLeadConversation, addNote } from '../api';

const TAG_META = {
  HOT:  { text:'#991b1b', bg:'#fef2f2', border:'#fecaca', dot:'#ef4444' },
  WARM: { text:'#92400e', bg:'#fffbeb', border:'#fde68a', dot:'#f59e0b' },
  COLD: { text:'#1e3a8a', bg:'#eff6ff', border:'#bfdbfe', dot:'#3b82f6' },
};
const ST_META = {
  NEW:       { text:'#166534', bg:'#f0fdf4' },
  CONTACTED: { text:'#1e3a8a', bg:'#eff6ff' },
  QUALIFIED: { text:'#4c1d95', bg:'#f5f3ff' },
  CONVERTED: { text:'#14532d', bg:'#f0fdf4' },
  LOST:      { text:'#991b1b', bg:'#fef2f2' },
};

function Avatar({ name, phone }) {
  const colors = ['#6366f1','#f97316','#0ea5e9','#a855f7','#14b8a6','#f43f5e'];
  const idx = (name||phone||'').charCodeAt(0) % colors.length;
  const bg = colors[idx];
  return (
    <div style={{ width:34, height:34, borderRadius:99, background:`${bg}18`, border:`1.5px solid ${bg}35`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:bg, flexShrink:0, letterSpacing:'-0.02em' }}>
      {(name||phone||'?')[0].toUpperCase()}
    </div>
  );
}

function ScoreBar({ score }) {
  const color = score>=70 ? '#22c55e' : score>=40 ? '#f59e0b' : '#94a3b8';
  return (
    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
      <div style={{ width:52, height:3, background:'var(--bg2)', borderRadius:99, overflow:'hidden', flexShrink:0 }}>
        <div style={{ height:'100%', width:`${score}%`, background:color, borderRadius:99, transition:'width 0.9s cubic-bezier(0.16,1,0.3,1)' }}/>
      </div>
      <span style={{ fontSize:11, color:'var(--text3)', fontWeight:600, fontFamily:'monospace', minWidth:20 }}>{score}</span>
    </div>
  );
}

function ChatModal({ leadId, onClose }) {
  const [data, setData]   = useState(null);
  const [note, setNote]   = useState('');
  const [busy, setBusy]   = useState(false);
  const bottomRef = useRef();

  useEffect(() => { getLeadConversation(leadId).then(r=>setData(r.data.data)); }, [leadId]);
  useEffect(() => { bottomRef.current?.scrollIntoView({behavior:'smooth'}); }, [data?.messages?.length]);

  const submit = async () => {
    if (!note.trim()) return;
    setBusy(true);
    try { await addNote(leadId, note); setNote(''); }
    finally { setBusy(false); }
  };

  return (
    <div className="modal-backdrop" onClick={e=>e.target===e.currentTarget&&onClose()}>
      <div className="modal" style={{ maxWidth:560 }}>
        <div className="modal-header">
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            {data && <Avatar name={data.lead?.name} phone={data.lead?.phone}/>}
            <div>
              <div style={{ fontWeight:600, fontSize:15, letterSpacing:'-0.02em' }}>{data?.lead?.name||'Unknown Lead'}</div>
              <div style={{ fontSize:11, color:'var(--text3)', fontFamily:'monospace', marginTop:1 }}>+{data?.lead?.phone}</div>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            {data?.lead?.tag && <span className={`badge badge-${data.lead.tag.toLowerCase()}`}>{data.lead.tag}</span>}
            <button onClick={onClose} className="btn btn-ghost btn-icon" style={{ color:'var(--text3)', fontSize:16, fontWeight:300 }}>✕</button>
          </div>
        </div>

        <div className="modal-body" style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:8, minHeight:280, maxHeight:380 }}>
          {!data ? <div className="spinner"/> : data.messages.length===0 ? (
            <div className="empty" style={{ padding:'40px 0' }}>
              <div style={{ fontSize:28, opacity:0.2, marginBottom:10 }}>💬</div>
              <div style={{ fontSize:13, color:'var(--text3)' }}>No messages yet</div>
            </div>
          ) : data.messages.map(msg=>(
            <div key={msg.id} style={{ display:'flex', justifyContent:msg.direction==='INBOUND'?'flex-start':'flex-end' }}>
              <div style={{
                maxWidth:'76%', padding:'9px 13px',
                borderRadius:msg.direction==='INBOUND'?'4px 13px 13px 13px':'13px 4px 13px 13px',
                background:msg.direction==='INBOUND'?'var(--bg2)':'var(--text)',
                border:msg.direction==='INBOUND'?'1px solid var(--border)':'none',
                color:msg.direction==='INBOUND'?'var(--text)':'white',
                fontSize:13, lineHeight:1.55,
              }}>
                <div>{msg.body}</div>
                <div style={{ fontSize:10, marginTop:4, opacity:0.45, textAlign:'right', display:'flex', gap:4, justifyContent:'flex-end' }}>
                  {new Date(msg.sentAt).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}
                  {msg.direction==='OUTBOUND' && <span>{msg.status==='READ'?'✓✓':msg.status==='DELIVERED'?'✓✓':'✓'}</span>}
                </div>
              </div>
            </div>
          ))}
          <div ref={bottomRef}/>
        </div>

        <div className="modal-footer">
          <div style={{ display:'flex', gap:8 }}>
            <input value={note} onChange={e=>setNote(e.target.value)} placeholder="Add a note about this lead..." onKeyDown={e=>e.key==='Enter'&&submit()}/>
            <button onClick={submit} className="btn btn-primary" disabled={busy} style={{ flexShrink:0 }}>{busy?'...':'Save note'}</button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function Leads() {
  const [leads,    setLeads]    = useState([]);
  const [total,    setTotal]    = useState(0);
  const [loading,  setLoading]  = useState(true);
  const [search,   setSearch]   = useState('');
  const [tag,      setTag]      = useState('ALL');
  const [status,   setStatus]   = useState('ALL');
  const [chatId,   setChatId]   = useState(null);
  const [updating, setUpdating] = useState({});
  const [selected, setSelected] = useState(new Set());
  const [sortBy,   setSortBy]   = useState('createdAt');
  const [sortDir,  setSortDir]  = useState('desc');

  const fetch = useCallback(async () => {
    setLoading(true);
    try {
      const p = {};
      if (search) p.search = search;
      if (tag    !== 'ALL') p.tag    = tag;
      if (status !== 'ALL') p.status = status;
      const r = await getLeads(p);
      setLeads(r.data.data);
      setTotal(r.data.pagination.total);
    } finally { setLoading(false); }
  }, [search,tag,status]);

  useEffect(() => { const t = setTimeout(fetch, 280); return()=>clearTimeout(t); }, [fetch]);

  const patch = async (id, field, val) => {
    setUpdating(u=>({...u,[id]:true}));
    setLeads(l=>l.map(lead=>lead.id===id?{...lead,[field]:val}:lead));
    await updateLead(id,{[field]:val});
    setUpdating(u=>({...u,[id]:false}));
  };

  const toggleSelect = (id) => {
    setSelected(s => { const n = new Set(s); n.has(id)?n.delete(id):n.add(id); return n; });
  };
  const allSelected = leads.length>0 && leads.every(l=>selected.has(l.id));
  const toggleAll   = () => setSelected(allSelected ? new Set() : new Set(leads.map(l=>l.id)));

  const sortIcon = (col) => sortBy===col ? (sortDir==='asc'?'↑':'↓') : '';

  return (
    <div>
      {/* Header */}
      <div className="fade-up" style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:22 }}>
        <div>
          <h2 style={{ fontFamily:'var(--font)', fontSize:22, fontWeight:400, fontStyle:'italic', letterSpacing:'-0.02em', marginBottom:3 }}>All leads</h2>
          <p style={{ fontSize:12, color:'var(--text3)' }}>{total} leads total · {leads.filter(l=>l.tag==='HOT').length} hot</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={fetch} className="btn btn-ghost btn-sm">↻ Refresh</button>
          <a href="http://localhost:3000/api/leads/export" className="btn btn-ghost btn-sm" style={{ textDecoration:'none' }}>↓ Export CSV</a>
          {selected.size > 0 && (
            <div style={{ display:'flex', gap:6, padding:'4px 10px', background:'var(--indigo-lt)', border:'1px solid #c7d2fe', borderRadius:'var(--r2)', alignItems:'center', fontSize:12, color:'var(--indigo)', fontWeight:600 }}>
              {selected.size} selected
            </div>
          )}
        </div>
      </div>

      {/* Filters */}
      <div className="card fade-up" style={{ animationDelay:'60ms', marginBottom:14, padding:'13px 18px', display:'flex', gap:10, alignItems:'center', flexWrap:'wrap' }}>
        {/* Search */}
        <div style={{ flex:1, minWidth:200, position:'relative' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text4)' }}>
            <circle cx="11" cy="11" r="7" stroke="#bdbdb6" strokeWidth="2"/>
            <path d="m21 21-4.35-4.35" stroke="#bdbdb6" strokeWidth="2" strokeLinecap="round"/>
          </svg>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search name, phone, or email..." style={{ paddingLeft:30 }}/>
        </div>

        {/* Tag filter pills */}
        <div style={{ display:'flex', gap:5 }}>
          {['ALL','HOT','WARM','COLD'].map(t => {
            const m = TAG_META[t];
            return (
              <button key={t} onClick={()=>setTag(t)} className="btn btn-xs" style={{
                background: tag===t&&t!=='ALL' ? m?.bg : tag===t ? 'var(--bg2)' : 'transparent',
                border:`1px solid ${tag===t&&t!=='ALL' ? m?.border : tag===t ? 'var(--border2)' : 'var(--border)'}`,
                color: tag===t&&t!=='ALL' ? m?.text : tag===t ? 'var(--text)' : 'var(--text3)',
                fontWeight: tag===t ? 600 : 400,
                display:'flex', alignItems:'center', gap:4,
              }}>
                {t!=='ALL' && <span style={{ width:6, height:6, borderRadius:99, background:m?.dot, display:'inline-block', flexShrink:0 }}/>}
                {t}
              </button>
            );
          })}
        </div>

        {/* Status */}
        <select value={status} onChange={e=>setStatus(e.target.value)} style={{ width:148, height:32, fontSize:12, padding:'4px 10px' }}>
          {['ALL','NEW','CONTACTED','QUALIFIED','CONVERTED','LOST'].map(s=><option key={s}>{s}</option>)}
        </select>

        {/* Summary pills */}
        <div style={{ display:'flex', gap:6, marginLeft:'auto' }}>
          {[
            { label:'Hot',  count:leads.filter(l=>l.tag==='HOT').length,  color:'#ef4444' },
            { label:'Warm', count:leads.filter(l=>l.tag==='WARM').length, color:'#f59e0b' },
          ].map(p=>(
            <div key={p.label} style={{ padding:'3px 9px', borderRadius:99, fontSize:11, background:`${p.color}12`, color:p.color, border:`1px solid ${p.color}28`, fontWeight:600 }}>
              {p.count} {p.label}
            </div>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="card-flat fade-up" style={{ animationDelay:'120ms' }}>
        {loading ? (
          <div style={{ padding:'40px 0' }}>
            {[...Array(5)].map((_,i)=>(
              <div key={i} style={{ display:'flex', gap:14, padding:'12px 20px', borderBottom:'1px solid var(--border)' }}>
                <div className="skeleton" style={{ width:34, height:34, borderRadius:99, flexShrink:0 }}/>
                <div style={{ flex:1 }}><div className="skeleton" style={{ height:10, width:'40%', marginBottom:6 }}/><div className="skeleton" style={{ height:8, width:'25%' }}/></div>
                <div className="skeleton" style={{ width:60, height:22, borderRadius:99 }}/>
                <div className="skeleton" style={{ width:80, height:22, borderRadius:99 }}/>
              </div>
            ))}
          </div>
        ) : leads.length===0 ? (
          <div className="empty">
            <div style={{ width:48, height:48, borderRadius:12, background:'var(--bg2)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', marginBottom:14, fontSize:22 }}>◉</div>
            <div style={{ fontWeight:600, fontSize:14, marginBottom:6 }}>No leads found</div>
            <div style={{ fontSize:13, color:'var(--text3)' }}>Try adjusting filters or start a campaign</div>
          </div>
        ) : (
          <table>
            <thead>
              <tr>
                <th style={{ paddingLeft:20, width:40 }}>
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} style={{ width:14, height:14, cursor:'pointer' }}/>
                </th>
                <th style={{ cursor:'pointer' }} onClick={()=>{ setSortBy('name'); setSortDir(d=>d==='asc'?'desc':'asc'); }}>
                  Lead {sortIcon('name')}
                </th>
                <th>Contact</th>
                <th>Tag</th>
                <th>Status</th>
                <th style={{ cursor:'pointer' }} onClick={()=>{ setSortBy('score'); setSortDir(d=>d==='asc'?'desc':'asc'); }}>
                  Score {sortIcon('score')}
                </th>
                <th>Activity</th>
                <th style={{ cursor:'pointer' }} onClick={()=>{ setSortBy('createdAt'); setSortDir(d=>d==='asc'?'desc':'asc'); }}>
                  Added {sortIcon('createdAt')}
                </th>
                <th style={{ width:110 }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {leads.map((lead,i) => {
                const tm = TAG_META[lead.tag]   || TAG_META.COLD;
                const sm = ST_META[lead.status] || ST_META.NEW;
                const isSelected = selected.has(lead.id);
                return (
                  <tr key={lead.id} className={`fade-in ${isSelected?'':''}`}
                    style={{
                      animationDelay:`${i*20}ms`,
                      opacity: updating[lead.id] ? 0.55 : 1,
                      background: isSelected ? '#eef2ff' : undefined,
                      transition:'opacity 0.15s,background 0.1s',
                    }}
                  >
                    <td style={{ paddingLeft:20 }}>
                      <input type="checkbox" checked={isSelected} onChange={()=>toggleSelect(lead.id)} style={{ width:14, height:14, cursor:'pointer' }}/>
                    </td>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                        <Avatar name={lead.name} phone={lead.phone}/>
                        <div>
                          <div style={{ fontWeight:500, fontSize:13, letterSpacing:'-0.01em' }}>{lead.name||'—'}</div>
                          {lead.email && <div style={{ fontSize:11, color:'var(--text3)', marginTop:1 }}>{lead.email}</div>}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontFamily:'monospace', fontSize:12, color:'var(--text2)', background:'var(--bg2)', padding:'3px 7px', borderRadius:4 }}>
                        +{lead.phone}
                      </span>
                    </td>
                    <td>
                      <select value={lead.tag} onChange={e=>patch(lead.id,'tag',e.target.value)} style={{
                        width:82, padding:'4px 8px', fontSize:11, fontWeight:600, height:26,
                        background:tm.bg, border:`1px solid ${tm.border}`, color:tm.text, cursor:'pointer',
                        borderRadius:'var(--r)',
                      }}>
                        {['HOT','WARM','COLD'].map(t=><option key={t}>{t}</option>)}
                      </select>
                    </td>
                    <td>
                      <select value={lead.status} onChange={e=>patch(lead.id,'status',e.target.value)} style={{
                        width:126, padding:'4px 8px', fontSize:11, fontWeight:600, height:26,
                        background:sm.bg, border:`1px solid ${sm.bg}`, color:sm.text, cursor:'pointer',
                        borderRadius:'var(--r)',
                      }}>
                        {['NEW','CONTACTED','QUALIFIED','CONVERTED','LOST'].map(s=><option key={s}>{s}</option>)}
                      </select>
                    </td>
                    <td><ScoreBar score={lead.qualificationScore||0}/></td>
                    <td>
                      <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                        <div style={{ width:24, height:24, borderRadius:99, background:'var(--bg2)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:10, fontWeight:700, color:'var(--text2)' }}>
                          {lead._count?.messages||0}
                        </div>
                        <span style={{ fontSize:11, color:'var(--text3)' }}>msgs</span>
                      </div>
                    </td>
                    <td>
                      <span style={{ fontSize:11, color:'var(--text3)' }}>
                        {new Date(lead.createdAt).toLocaleDateString('en-US',{month:'short',day:'numeric'})}
                      </span>
                    </td>
                    <td>
                      <div style={{ display:'flex', gap:5 }}>
                        <button onClick={()=>setChatId(lead.id)} className="btn btn-ghost btn-xs" style={{ fontSize:11 }} title="View conversation">
                          💬 Chat
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}

        {/* Table footer */}
        {leads.length > 0 && (
          <div style={{ padding:'12px 20px', borderTop:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center', background:'var(--surface2)' }}>
            <span style={{ fontSize:12, color:'var(--text3)' }}>
              Showing {leads.length} of {total} leads
              {selected.size>0 && <span style={{ color:'var(--indigo)', fontWeight:600, marginLeft:8 }}>· {selected.size} selected</span>}
            </span>
            <div style={{ display:'flex', gap:6 }}>
              {[
                { label:'All leads',  count:total                                        },
                { label:'Hot',        count:leads.filter(l=>l.tag==='HOT').length,   color:'var(--red)' },
                { label:'Converted',  count:leads.filter(l=>l.status==='CONVERTED').length, color:'var(--green-mid)' },
              ].map(s=>(
                <span key={s.label} style={{ fontSize:11, color:s.color||'var(--text3)' }}>
                  {s.label}: <strong style={{ color:s.color||'var(--text)' }}>{s.count}</strong>
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      {chatId && <ChatModal leadId={chatId} onClose={()=>setChatId(null)}/>}
    </div>
  );
}