import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Layout      from './components/Layout';
import Overview    from './pages/Overview';
import Leads       from './pages/Leads';
import Campaigns   from './pages/Campaigns';
import Automations from './pages/Automations';
import Analytics   from './pages/Analytics';
import './index.css';

export default function App() {
  return (
    <BrowserRouter>
      <Layout>
        <Routes>
          <Route path="/"            element={<Overview />}    />
          <Route path="/leads"       element={<Leads />}       />
          <Route path="/campaigns"   element={<Campaigns />}   />
          <Route path="/automations" element={<Automations />} />
          <Route path="/analytics"   element={<Analytics />}   />
        </Routes>
      </Layout>
    </BrowserRouter>
  );
}