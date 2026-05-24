import { Route, Routes } from 'react-router-dom';
import Layout from '../components/Layout';
import AdminPage from '../pages/AdminPage';
import HomePage from '../pages/HomePage';
import LoginPseudoPage from '../pages/LoginPseudoPage';
import QrPage from '../pages/QrPage';
import ResultsPage from '../pages/ResultsPage';
import VehicleVotePage from '../pages/VehicleVotePage';
import VehiclesPage from '../pages/VehiclesPage';

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/login" element={<LoginPseudoPage />} />
        <Route path="/vehicles" element={<VehiclesPage />} />
        <Route path="/vehicles/:vehicleId" element={<VehicleVotePage />} />
        <Route path="/results" element={<ResultsPage />} />
        <Route path="/qr" element={<QrPage />} />
        <Route path="/admin" element={<AdminPage />} />
      </Routes>
    </Layout>
  );
}
