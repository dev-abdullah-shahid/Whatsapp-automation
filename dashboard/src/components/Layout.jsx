import { NavLink, useLocation } from 'react-router-dom';
import { useState } from 'react';

const Icons = {
  Overview: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <rect x="3" y="3" width="8" height="8" rx="2" fill="#6366f1" fillOpacity="0.2" stroke="#6366f1" strokeWidth="1.5"/>
      <rect x="13" y="3" width="8" height="8" rx="2" fill="#6366f1" fillOpacity="0.1" stroke="#6366f1" strokeWidth="1.5" strokeDasharray="2 1"/>
      <rect x="3" y="13" width="8" height="8" rx="2" fill="#6366f1" fillOpacity="0.1" stroke="#6366f1" strokeWidth="1.5" strokeDasharray="2 1"/>
      <rect x="13" y="13" width="8" height="8" rx="2" fill="#6366f1" fillOpacity="0.2" stroke="#6366f1" strokeWidth="1.5"/>
    </svg>
  ),
  Leads: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <circle cx="9" cy="7" r="4" fill="#f97316" fillOpacity="0.15" stroke="#f97316" strokeWidth="1.5"/>
      <path d="M3 21v-1a6 6 0 0 1 6-6h0a6 6 0 0 1 6 6v1" stroke="#f97316" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M17 11l2 2 4-4" stroke="#22c55e" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Campaigns: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M22 12c0 5.523-4.477 10-10 10S2 17.523 2 12 6.477 2 12 2s10 4.477 10 10z" fill="#0ea5e9" fillOpacity="0.1" stroke="#0ea5e9" strokeWidth="1.5"/>
      <path d="M8 12h8M12 8l4 4-4 4" stroke="#0ea5e9" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
  Automations: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" stroke="#a855f7" strokeWidth="1.5" strokeLinecap="round"/>
      <circle cx="12" cy="12" r="3" fill="#a855f7" fillOpacity="0.2" stroke="#a855f7" strokeWidth="1.5"/>
    </svg>
  ),
  Analytics: () => (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M3 3v18h18" stroke="#14b8a6" strokeWidth="1.5" strokeLinecap="round"/>
      <path d="M7 14l4-5 4 3 4-6" stroke="#14b8a6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
      <circle cx="7"  cy="14" r="1.5" fill="#14b8a6"/>
      <circle cx="11" cy="9"  r="1.5" fill="#14b8a6"/>
      <circle cx="15" cy="12" r="1.5" fill="#14b8a6"/>
      <circle cx="19" cy="6"  r="1.5" fill="#14b8a6"/>
    </svg>
  ),
  Menu: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M4 6h16M4 12h16M4 18h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  ),
  Search: () => (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="1.8"/>
      <path d="m21 21-4.35-4.35" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"/>
    </svg>
  ),
  Bell: () => (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9M13.73 21a2 2 0 0 1-3.46 0" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  ),
};

const NAV = [
  { to:'/',            Icon:Icons.Overview,    label:'Overview',    accent:'#6366f1' },
  { to:'/leads',       Icon:Icons.Leads,       label:'Leads',       accent:'#f97316' },
  { to:'/campaigns',   Icon:Icons.Campaigns,   label:'Campaigns',   accent:'#0ea5e9' },
  { to:'/automations', Icon:Icons.Automations, label:'Automations', accent:'#a855f7' },
  { to:'/analytics',   Icon:Icons.Analytics,   label:'Analytics',   accent:'#14b8a6' },
];

const W_OPEN   = 260;
const W_CLOSED = 58;

export default function Layout({ children }) {
  const [open, setOpen] = useState(true);
  const location = useLocation();
  const currentNav = NAV.find(n => n.to === location.pathname) || NAV[0];
  const sideW = open ? W_OPEN : W_CLOSED;

  return (
    <div style={{ display:'flex', minHeight:'100vh', background:'var(--bg)' }}>

      {/* ── Sidebar ── */}
      <aside style={{
        width: sideW,
        minWidth: sideW,
        flexShrink: 0,
        background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        position: 'fixed',
        top:0, left:0, bottom:0,
        zIndex: 100,
        transition: 'width 0.25s cubic-bezier(0.16,1,0.3,1), min-width 0.25s cubic-bezier(0.16,1,0.3,1)',
        overflow: 'hidden',
      }}>

        {/* ── Logo row ── */}
        <div style={{
          height: 'var(--topbar)',
          display: 'flex',
          alignItems: 'center',
          padding: open ? '0 16px' : '0',
          justifyContent: open ? 'flex-start' : 'center',
          borderBottom: '1px solid var(--border)',
          gap: 10,
          flexShrink: 0,
          transition: 'padding 0.25s, justify-content 0.25s',
          overflow: 'hidden',
        }}>
          {/*
            ── YOUR LOGO ─────────────────────────────────────────
            Drop your file into:  dashboard/public/logo.png
            It renders here automatically. If logo.png is missing
            it falls back to a plain white "W" on dark background.
            To use a different format: change src="/logo.png"
            ─────────────────────────────────────────────────────
          */}
          <div style={{ width:34, height:34, borderRadius:8, flexShrink:0, overflow:'hidden', background:'var(--text)', display:'flex', alignItems:'center', justifyContent:'center', boxShadow:'var(--sh-xs)' }}>
            <img
              src="/logo.png"
              alt="Logo"
              style={{ width:'100%', height:'100%', objectFit:'cover', display:'block' }}
              onError={e => {
                e.currentTarget.style.display = 'none';
                e.currentTarget.parentElement.innerHTML = `<span style="color:white;font-size:14px;font-weight:700;font-family:sans-serif;letter-spacing:-0.03em">W</span>`;
              }}
            />
          </div>

          {/* Text — slides and fades away on collapse */}
          <div style={{
            overflow: 'hidden',
            opacity: open ? 1 : 0,
            maxWidth: open ? 180 : 0,
            transition: 'opacity 0.18s ease, max-width 0.25s cubic-bezier(0.16,1,0.3,1)',
            pointerEvents: open ? 'auto' : 'none',
            whiteSpace: 'nowrap',
            flexShrink: 0,
          }}>
            <div style={{ fontFamily:'var(--font)', fontSize:15, fontWeight:400, fontStyle:'italic', color:'var(--text)', letterSpacing:'-0.01em', lineHeight:1.3 }}>
              WhatsApp AI
            </div>
            <div style={{ fontSize:10, color:'var(--text3)', fontWeight:500, letterSpacing:'0.04em', textTransform:'uppercase' }}>
              Growth Platform
            </div>
          </div>
        </div>

        {/* ── Nav links ── */}
        <nav style={{ padding: open ? '10px 10px' : '10px 8px', flex:1, overflowY:'auto', overflowX:'hidden' }}>

          {/* Section label — only when open */}
          <div style={{
            fontSize:10, color:'var(--text4)', fontWeight:600,
            letterSpacing:'0.09em', textTransform:'uppercase',
            padding: open ? '6px 10px 8px' : '6px 0 8px',
            overflow:'hidden',
            opacity: open ? 1 : 0,
            maxHeight: open ? 30 : 0,
            transition: 'opacity 0.15s, max-height 0.2s',
            textAlign: 'center',
          }}>
            Navigation
          </div>

          {NAV.map(({ to, Icon, label, accent }) => (
            <NavLink
              key={to}
              to={to}
              end={to === '/'}
              /* Native tooltip when collapsed */
              title={!open ? label : undefined}
              style={({ isActive }) => ({
                display: 'flex',
                alignItems: 'center',
                gap: open ? 11 : 0,
                justifyContent: open ? 'flex-start' : 'center',
                padding: open ? '10px 12px' : '10px 0',
                borderRadius: 'var(--r2)',
                marginBottom: 3,
                textDecoration: 'none',
                fontSize: 13,
                fontWeight: isActive ? 600 : 400,
                color: isActive ? 'var(--text)' : 'var(--text2)',
                background: isActive ? 'var(--bg2)' : 'transparent',
                /* Accent left border when open, ring when collapsed */
                borderLeft: open
                  ? (isActive ? `3px solid ${accent}` : '3px solid transparent')
                  : 'none',
                outline: !open && isActive ? `2px solid ${accent}44` : 'none',
                outlineOffset: 3,
                transition: 'all 0.13s',
                letterSpacing: '-0.01em',
                overflow: 'hidden',
                position: 'relative',
              })}
            >
              {/* Icon always visible */}
              <span style={{ flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', width:18 }}>
                <Icon />
              </span>

              {/* Label — collapses smoothly */}
              <span style={{
                overflow: 'hidden',
                opacity: open ? 1 : 0,
                maxWidth: open ? 180 : 0,
                transition: 'opacity 0.15s ease, max-width 0.22s cubic-bezier(0.16,1,0.3,1)',
                whiteSpace: 'nowrap',
                flexShrink: 0,
              }}>
                {label}
              </span>
            </NavLink>
          ))}
        </nav>

        {/* ── Status footer ── */}
        <div style={{
          padding: open ? '13px 18px' : '13px 0',
          borderTop: '1px solid var(--border)',
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: open ? 'flex-start' : 'center',
          gap: open ? 8 : 0,
          overflow: 'hidden',
          transition: 'padding 0.25s',
        }}>
          <div className="dot-live" style={{ flexShrink:0 }} />
          <div style={{
            overflow: 'hidden',
            opacity: open ? 1 : 0,
            maxWidth: open ? 200 : 0,
            transition: 'opacity 0.15s, max-width 0.25s',
            whiteSpace: 'nowrap',
          }}>
            <div style={{ fontSize:12, color:'var(--green-mid)', fontWeight:600 }}>System live</div>
            <div style={{ fontSize:11, color:'var(--text3)', marginTop:1 }}>Meta Cloud API · v1.0.0</div>
          </div>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div style={{
        marginLeft: sideW,
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        transition: 'margin-left 0.25s cubic-bezier(0.16,1,0.3,1)',
        minWidth: 0,
      }}>

        {/* Topbar */}
        <header style={{
          height: 'var(--topbar)',
          background: 'rgba(245,244,241,0.88)',
          backdropFilter: 'blur(14px)',
          borderBottom: '1px solid var(--border)',
          display: 'flex', alignItems: 'center',
          padding: '0 24px', gap: 14,
          position: 'sticky', top:0, zIndex:50,
          justifyContent: 'space-between',
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:12 }}>
            {/* Hamburger — always visible, toggles sidebar */}
            <button
              onClick={() => setOpen(o => !o)}
              className="btn btn-ghost btn-icon"
              style={{ color:'var(--text2)', flexShrink:0 }}
              title={open ? 'Collapse sidebar' : 'Expand sidebar'}
            >
              <Icons.Menu />
            </button>

            {/* Breadcrumb */}
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ fontSize:12, color:'var(--text3)', fontWeight:500 }}>Platform</span>
              <span style={{ color:'var(--text4)', fontSize:13 }}>/</span>
              <span style={{ fontSize:13, fontWeight:600, color:'var(--text)', letterSpacing:'-0.01em' }}>
                {currentNav.label}
              </span>
            </div>
          </div>

          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            {/* Search */}
            <div style={{ position:'relative' }}>
              <span style={{ position:'absolute', left:10, top:'50%', transform:'translateY(-50%)', color:'var(--text4)', display:'flex' }}>
                <Icons.Search />
              </span>
              <input
                placeholder="Quick search..."
                style={{ width:210, background:'var(--bg2)', border:'1px solid var(--border)', fontSize:12, padding:'6px 10px 6px 28px', borderRadius:'var(--r2)', height:34, color:'var(--text)' }}
              />
            </div>

            {/* Bell */}
            <button className="btn btn-ghost btn-icon" style={{ color:'var(--text2)', position:'relative' }}>
              <Icons.Bell />
              <span style={{ position:'absolute', top:6, right:6, width:6, height:6, borderRadius:99, background:'#ef4444', border:'1.5px solid var(--surface)' }} />
            </button>

            <div style={{ width:1, height:22, background:'var(--border)' }} />

            {/* Avatar */}
            <div style={{ width:32, height:32, borderRadius:99, background:'var(--text)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'white', cursor:'pointer', flexShrink:0, letterSpacing:'-0.02em' }}>
              A
            </div>
          </div>
        </header>

        {/* Page content */}
        <main style={{ flex:1, padding:'28px 32px', overflowX:'hidden' }}>
          <div style={{ maxWidth:'var(--content)', margin:'0 auto' }}>
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}