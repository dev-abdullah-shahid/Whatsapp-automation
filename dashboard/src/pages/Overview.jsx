import { useEffect, useState } from 'react';
import { getOverview, getGrowth, getFunnel } from '../api';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--r2)', padding:'10px 14px', boxShadow:'var(--sh-md)', fontSize:12 }}>
      <div style={{ color:'var(--text3)', marginBottom:6, fontWeight:600 }}>{label}</div>
      {payload.map(p => (
        <div key={p.name} style={{ display:'flex', alignItems:'center', gap:7, color:'var(--text)', marginBottom:2 }}>
          <span style={{ width:8, height:8, borderRadius:99, background:p.color, display:'inline-block', flexShrink:0 }} />
          {p.name}: <strong style={{ marginLeft:2, fontFamily:'var(--font)' }}>{p.value}</strong>
        </div>
      ))}
    </div>
  );
};

function AnimatedNum({ value, prefix='', suffix='' }) {
  const [n, setN] = useState(0);
  const target = parseFloat(String(value).replace(/[^0-9.]/g,'')) || 0;
  const isFloat = String(value).includes('.');

  useEffect(() => {
    let cur = 0;
    const step = target / 30;
    const t = setInterval(() => {
      cur = Math.min(cur + step, target);
      setN(isFloat ? parseFloat(cur.toFixed(1)) : Math.round(cur));
      if (cur >= target) clearInterval(t);
    }, 28);
    return () => clearInterval(t);
  }, [target]);

  return <>{prefix}{isFloat ? n.toFixed(1) : n.toLocaleString()}{suffix}</>;
}

function StatCard({ label, value, sub, change, positive, icon, color, delay=0 }) {
  return (
    <div className="card fade-up" style={{ animationDelay:`${delay}ms`, padding:'20px 22px' }}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:16 }}>
        <div style={{ fontSize:12, fontWeight:500, color:'var(--text3)', letterSpacing:'-0.01em' }}>{label}</div>
        <div style={{ width:34, height:34, borderRadius:'var(--r)', background: color+'14', border:`1px solid ${color}28`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
          {icon}
        </div>
      </div>
      <div style={{ fontFamily:'var(--font)', fontSize:34, fontWeight:400, color:'var(--text)', letterSpacing:'-0.03em', lineHeight:1, marginBottom:10 }}>
        <AnimatedNum value={value} suffix={String(value).includes('%') ? '%' : ''} />
      </div>
      <div style={{ display:'flex', alignItems:'center', gap:7 }}>
        {change !== undefined && (
          <span style={{ fontSize:11, fontWeight:600, padding:'1px 7px', borderRadius:99, background: positive ? '#f0fdf4' : '#fef2f2', color: positive ? 'var(--green)' : 'var(--red)', border:`1px solid ${positive ? '#bbf7d0' : '#fecaca'}` }}>
            {positive ? '↑' : '↓'} {Math.abs(change)}%
          </span>
        )}
        {sub && <span style={{ fontSize:11, color:'var(--text3)' }}>{sub}</span>}
      </div>
    </div>
  );
}

export default function Overview() {
  const [ov, setOv]       = useState(null);
  const [growth, setG]    = useState([]);
  const [funnel, setF]    = useState([]);
  const [loading, setL]   = useState(true);

  useEffect(() => {
    Promise.all([getOverview(), getGrowth(7), getFunnel()])
      .then(([o, g, f]) => {
        setOv(o.data.data);
        setG(g.data.data);
        const s = f.data.data.stages;
        setF([
          { name:'New',       value:s.new,       color:'#6366f1' },
          { name:'Contacted', value:s.contacted,  color:'#0ea5e9' },
          { name:'Qualified', value:s.qualified,  color:'#a855f7' },
          { name:'Converted', value:s.converted,  color:'#22c55e' },
          { name:'Lost',      value:s.lost,       color:'#f87171' },
        ]);
      })
      .catch(()=>{})
      .finally(()=>setL(false));
  }, []);

  if (loading) return <div className="spinner" style={{ marginTop:80 }} />;

  const statCards = [
    {
      label:'Total Leads', value: ov?.leads?.total||0,
      sub:`${ov?.leads?.today||0} added today`, change:12, positive:true,
      color:'#6366f1',
      icon:(
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <circle cx="9" cy="7" r="4" stroke="#6366f1" strokeWidth="1.5"/>
          <path d="M3 21v-1a6 6 0 0 1 6-6h0a6 6 0 0 1 6 6v1" stroke="#6366f1" strokeWidth="1.5" strokeLinecap="round"/>
          <path d="M16 11l2 2 4-4" stroke="#22c55e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
    },
    {
      label:'Hot Leads', value: ov?.leads?.hot||0,
      sub:'Ready to convert',
      color:'#f97316',
      icon:(
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" fill="#f97316" fillOpacity="0.15" stroke="#f97316" strokeWidth="1.5"/>
          <path d="M12 6v4l3 1.5" stroke="#f97316" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          <circle cx="12" cy="16" r="1.5" fill="#f97316"/>
        </svg>
      ),
    },
    {
      label:'Total Messages', value: ov?.messages?.total||0,
      sub:`${ov?.messages?.inbound||0} inbound`,
      color:'#0ea5e9',
      icon:(
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" stroke="#0ea5e9" strokeWidth="1.5" strokeLinejoin="round" fill="#0ea5e9" fillOpacity="0.1"/>
          <path d="M8 10h8M8 14h5" stroke="#0ea5e9" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
      ),
    },
    {
      label:'Response Rate', value: ov?.rates?.responseRate||'0%',
      sub:'of contacted leads', change:5, positive:true,
      color:'#22c55e',
      icon:(
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
          <path d="M22 12h-4l-3 9L9 3l-3 9H2" stroke="#22c55e" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      ),
    },
  ];

  return (
    <div>
      {/* Header */}
      <div className="fade-up" style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:28 }}>
        <div>
          <h2 style={{ fontFamily:'var(--font)', fontSize:26, fontWeight:400, fontStyle:'italic', letterSpacing:'-0.02em', marginBottom:5, color:'var(--text)' }}>
            Good {new Date().getHours()<12?'morning':'afternoon'} 👋
          </h2>
          <p style={{ fontSize:13, color:'var(--text3)', fontWeight:400 }}>
            Here's what's happening across your WhatsApp pipeline today.
          </p>
        </div>
        <div style={{ background:'var(--surface)', border:'1px solid var(--border)', padding:'7px 14px', borderRadius:'var(--r2)', fontSize:12, color:'var(--text3)', fontWeight:500, flexShrink:0, boxShadow:'var(--sh-xs)' }}>
          {new Date().toLocaleDateString('en-US',{weekday:'short',month:'long',day:'numeric'})}
        </div>
      </div>

      {/* Stat cards */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:14, marginBottom:20 }}>
        {statCards.map((c,i) => <StatCard key={c.label} {...c} delay={i*60} />)}
      </div>

      {/* Charts row */}
      <div style={{ display:'grid', gridTemplateColumns:'minmax(0,2fr) minmax(0,1fr)', gap:14, marginBottom:14 }}>

        {/* Area chart */}
        <div className="card fade-up" style={{ animationDelay:'240ms', padding:'22px 22px 16px' }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:22 }}>
            <div>
              <div style={{ fontSize:13, fontWeight:600, letterSpacing:'-0.02em', marginBottom:3 }}>Lead growth</div>
              <div style={{ fontSize:12, color:'var(--text3)' }}>New leads acquired over 7 days</div>
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:11, color:'var(--text3)', background:'var(--bg2)', padding:'5px 10px', borderRadius:'var(--r)', border:'1px solid var(--border)' }}>
              <span style={{ width:8, height:8, borderRadius:99, background:'#6366f1', display:'inline-block' }}/>
              New leads
            </div>
          </div>
          <ResponsiveContainer width="100%" height={190}>
            <AreaChart data={growth} margin={{top:4,right:4,bottom:0,left:-20}}>
              <defs>
                <linearGradient id="gGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%"   stopColor="#6366f1" stopOpacity={0.18}/>
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid vertical={false} stroke="var(--border)" strokeDasharray="0"/>
              <XAxis dataKey="date" tickFormatter={d=>d.slice(5)} tick={{fontSize:10,fill:'var(--text3)'}} axisLine={false} tickLine={false}/>
              <YAxis tick={{fontSize:10,fill:'var(--text3)'}} axisLine={false} tickLine={false} allowDecimals={false}/>
              <Tooltip content={<CustomTooltip />}/>
              <Area type="monotone" dataKey="leads" name="Leads" stroke="#6366f1" strokeWidth={1.8} fill="url(#gGrad)" dot={false} activeDot={{r:4,fill:'#6366f1',strokeWidth:0}}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Funnel */}
        <div className="card fade-up" style={{ animationDelay:'300ms' }}>
          <div style={{ fontSize:13, fontWeight:600, letterSpacing:'-0.02em', marginBottom:4 }}>Pipeline funnel</div>
          <div style={{ fontSize:12, color:'var(--text3)', marginBottom:22 }}>Lead qualification stages</div>
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {funnel.map((s,i) => (
              <div key={s.name} className="fade-in" style={{ animationDelay:`${360+i*50}ms` }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:6 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:7 }}>
                    <span style={{ width:8, height:8, borderRadius:99, background:s.color, display:'inline-block', flexShrink:0 }}/>
                    <span style={{ fontSize:12, color:'var(--text2)', fontWeight:500 }}>{s.name}</span>
                  </div>
                  <span style={{ fontSize:13, fontWeight:600, color:'var(--text)', fontFamily:'var(--font)' }}>{s.value}</span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width:`${funnel[0]?.value>0?(s.value/funnel[0].value*100):0}%`, background:s.color }}/>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:14 }}>
        {[
          { label:'Inbound messages',  value:ov?.messages?.inbound||0,  note:'Received from leads',    color:'#0ea5e9' },
          { label:'Outbound messages', value:ov?.messages?.outbound||0, note:'Sent to leads',           color:'#a855f7' },
          { label:'Converted leads',   value:ov?.leads?.converted||0,   note:ov?.rates?.conversionRate+' conversion rate', color:'#22c55e' },
        ].map((item,i) => (
          <div key={item.label} className="card fade-up" style={{ animationDelay:`${480+i*60}ms`, padding:'18px 22px', display:'flex', alignItems:'center', gap:16 }}>
            <div style={{ width:42, height:42, borderRadius:'var(--r2)', background:item.color+'12', border:`1px solid ${item.color}22`, display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
              <div style={{ width:16, height:16, borderRadius:4, background:item.color, opacity:0.7 }}/>
            </div>
            <div style={{ flex:1 }}>
              <div style={{ fontSize:11, color:'var(--text3)', fontWeight:500, marginBottom:5 }}>{item.label}</div>
              <div style={{ fontFamily:'var(--font)', fontSize:26, fontWeight:400, letterSpacing:'-0.03em', color:'var(--text)', lineHeight:1 }}>
                {Number(item.value).toLocaleString()}
              </div>
              <div style={{ fontSize:11, color:'var(--text3)', marginTop:5 }}>{item.note}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}