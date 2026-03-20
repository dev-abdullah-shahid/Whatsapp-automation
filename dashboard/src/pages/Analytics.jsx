import { useEffect, useState } from 'react';
import { getGrowth, getTrackingDashboard } from '../api';
import { AreaChart, Area, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active||!payload?.length) return null;
  return (
    <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r2)', padding:'10px 14px', boxShadow:'var(--sh-md)', fontSize:12 }}>
      <div style={{ color:'var(--text3)', marginBottom:6, fontWeight:600 }}>{label}</div>
      {payload.map(p=>(
        <div key={p.name} style={{ display:'flex', alignItems:'center', gap:7, color:'var(--text)', marginBottom:2 }}>
          <span style={{ width:8, height:8, borderRadius:99, background:p.color||p.fill, display:'inline-block', flexShrink:0 }}/>
          {p.name}: <strong style={{ marginLeft:2 }}>{p.value}</strong>
        </div>
      ))}
    </div>
  );
};

export default function Analytics() {
  const [growth,   setG]  = useState([]);
  const [tracking, setT]  = useState(null);
  const [loading,  setL]  = useState(true);
  const [days,     setD]  = useState(14);

  useEffect(()=>{
    setL(true);
    Promise.all([getGrowth(days), getTrackingDashboard()])
      .then(([g,t])=>{ setG(g.data.data); setT(t.data.data); })
      .catch(()=>{})
      .finally(()=>setL(false));
  },[days]);

  if (loading) return <div className="spinner" style={{ marginTop:80 }}/>;

  const tiles = [
    { label:'Total messages',    value:tracking?.summary?.totalMessages    ||0,    color:'#6366f1', note:'All time'            },
    { label:'Delivered',         value:tracking?.summary?.deliveredMessages ||0,    color:'#0ea5e9', note:'Confirmed delivery'  },
    { label:'Read',              value:tracking?.summary?.readMessages      ||0,    color:'#22c55e', note:'Opened by recipient', highlight:true },
    { label:'Delivery rate',     value:tracking?.summary?.overallDeliveryRate||'0%',color:'#22c55e', note:'Of messages sent'    },
    { label:'Read rate',         value:tracking?.summary?.overallReadRate   ||'0%', color:'#a855f7', note:'Of delivered'        },
    { label:'Active campaigns',  value:tracking?.summary?.activeCampaigns   ||0,    color:'#f97316', note:'Currently running'   },
  ];

  return (
    <div>
      <div className="fade-up" style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:22 }}>
        <div>
          <h2 style={{ fontFamily:'var(--font)', fontSize:22, fontWeight:400, fontStyle:'italic', letterSpacing:'-0.02em', marginBottom:3 }}>Analytics</h2>
          <p style={{ fontSize:12, color:'var(--text3)' }}>Pipeline performance and message delivery insights</p>
        </div>
        <div style={{ display:'flex', gap:4, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r2)', padding:3, boxShadow:'var(--sh-xs)' }}>
          {[7,14,30].map(d=>(
            <button key={d} onClick={()=>setD(d)} style={{
              padding:'4px 12px', borderRadius:'var(--r)', border:'none', cursor:'pointer',
              fontSize:12, fontWeight:500,
              background:days===d?'var(--text)':'transparent',
              color:days===d?'white':'var(--text3)',
              transition:'all 0.12s',
            }}>
              {d}d
            </button>
          ))}
        </div>
      </div>

      {/* Tiles */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:12, marginBottom:18 }}>
        {tiles.map((t,i)=>(
          <div key={t.label} className="card fade-up" style={{ animationDelay:`${i*40}ms`, padding:'16px 18px', background: t.highlight ? `${t.color}06` : 'var(--surface)', borderColor: t.highlight ? `${t.color}25` : 'var(--border)' }}>
            <div style={{ fontSize:11, color:'var(--text3)', fontWeight:500, marginBottom:10 }}>{t.label}</div>
            <div style={{ fontFamily:'var(--font)', fontSize:24, fontWeight:400, letterSpacing:'-0.03em', color:t.highlight?t.color:'var(--text)', lineHeight:1, marginBottom:5 }}>
              {t.value}
            </div>
            <div style={{ fontSize:10, color:'var(--text4)' }}>{t.note}</div>
          </div>
        ))}
      </div>

      {/* Charts */}
      <div style={{ display:'grid', gridTemplateColumns:'3fr 2fr', gap:14, marginBottom:14 }}>
        <div className="card fade-up" style={{ animationDelay:'240ms', padding:'22px 22px 16px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:22 }}>
            <div>
              <div style={{ fontSize:13, fontWeight:600, letterSpacing:'-0.02em', marginBottom:3 }}>Message volume</div>
              <div style={{ fontSize:12, color:'var(--text3)' }}>Sent vs received per day over {days} days</div>
            </div>
            <div style={{ display:'flex', gap:12 }}>
              {[{l:'Sent',c:'#6366f1'},{l:'Received',c:'#22c55e'}].map(x=>(
                <div key={x.l} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'var(--text3)' }}>
                  <span style={{ width:8, height:8, borderRadius:2, background:x.c, display:'inline-block' }}/>
                  {x.l}
                </div>
              ))}
            </div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={tracking?.msgPerDay||[]} margin={{top:0,right:4,bottom:0,left:-20}} barCategoryGap="38%">
              <CartesianGrid vertical={false} stroke="var(--border)"/>
              <XAxis dataKey="date" tickFormatter={d=>d.slice(5)} tick={{fontSize:10,fill:'var(--text3)'}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fontSize:10,fill:'var(--text3)'}} axisLine={false} tickLine={false} allowDecimals={false}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Bar dataKey="sent"     name="Sent"     fill="#6366f1" radius={[3,3,0,0]} fillOpacity={0.85}/>
              <Bar dataKey="received" name="Received" fill="#22c55e" radius={[3,3,0,0]} fillOpacity={0.85}/>
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card fade-up" style={{ animationDelay:'300ms', padding:'22px 22px 16px' }}>
          <div style={{ marginBottom:22 }}>
            <div style={{ fontSize:13, fontWeight:600, letterSpacing:'-0.02em', marginBottom:3 }}>Lead growth</div>
            <div style={{ fontSize:12, color:'var(--text3)' }}>New leads per day</div>
          </div>
          <ResponsiveContainer width="100%" height={200}>
            <AreaChart data={growth} margin={{top:0,right:4,bottom:0,left:-20}}>
              <defs>
                <linearGradient id="aGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#a855f7" stopOpacity={0.18}/>
                  <stop offset="100%" stopColor="#a855f7" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--border)"/>
              <XAxis dataKey="date" tickFormatter={d=>d.slice(5)} tick={{fontSize:10,fill:'var(--text3)'}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fontSize:10,fill:'var(--text3)'}} axisLine={false} tickLine={false} allowDecimals={false}/>
              <Tooltip content={<CustomTooltip/>}/>
              <Area type="monotone" dataKey="leads" name="Leads" stroke="#a855f7" strokeWidth={1.8} fill="url(#aGrad)" dot={false} activeDot={{r:4,fill:'#a855f7',strokeWidth:0}}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top campaigns table */}
      {tracking?.topCampaigns?.length>0 && (
        <div className="card-flat fade-up" style={{ animationDelay:'360ms', overflow:'hidden' }}>
          <div style={{ padding:'16px 20px', borderBottom:'1px solid var(--border)', display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <div style={{ fontSize:13, fontWeight:600, letterSpacing:'-0.02em' }}>Top campaigns by volume</div>
            <div style={{ fontSize:11, color:'var(--text3)' }}>Completed campaigns only</div>
          </div>
          <table>
            <thead>
              <tr>
                <th style={{ paddingLeft:20 }}>Campaign name</th>
                <th>Messages sent</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {tracking.topCampaigns.map((c,i)=>(
                <tr key={c.id} className="fade-in" style={{ animationDelay:`${400+i*30}ms` }}>
                  <td style={{ paddingLeft:20 }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ width:6, height:6, borderRadius:99, background:'#a855f7', flexShrink:0 }}/>
                      <span style={{ fontWeight:500 }}>{c.name}</span>
                    </div>
                  </td>
                  <td>
                    <span style={{ fontFamily:'var(--font)', fontSize:16, color:'var(--text)' }}>{c.messages}</span>
                  </td>
                  <td>
                    <span className={`badge badge-${c.status.toLowerCase()}`}>{c.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}