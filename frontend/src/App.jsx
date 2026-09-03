import { Routes, Route } from 'react-router-dom';
import Landing from './pages/Landing.jsx';
import Auth from './pages/Auth.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Analytics from './pages/Analytics.jsx';
import Stock from './pages/Stock.jsx';
import Udhaar from './pages/Udhaar.jsx';
import Alerts from './pages/Alerts.jsx';
import Reports from './pages/Reports.jsx';
import SystemHealth from './pages/SystemHealth.jsx';

// Real page content is built part-by-part:
//   Landing       -> Part 3
//   Auth          -> Part 4
//   Dashboard     -> Part 6
//   Analytics     -> Part 8
//   Stock         -> Part 9b
//   Udhaar        -> Part 9b
//   Alerts        -> Part 10a
//   Reports       -> Part 10b
//   SystemHealth  -> Part 10b (public, no login)
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/dashboard" element={<Dashboard />} />
      <Route path="/analytics" element={<Analytics />} />
      <Route path="/stock" element={<Stock />} />
      <Route path="/udhaar" element={<Udhaar />} />
      <Route path="/alerts" element={<Alerts />} />
      <Route path="/reports" element={<Reports />} />
      <Route path="/system-health" element={<SystemHealth />} />
    </Routes>
  );
}