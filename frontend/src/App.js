import React from 'react';
import '@/App.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { Toaster } from '@/components/ui/sonner';
import Layout from '@/components/Layout';

import Landing from '@/pages/Landing';
import Login from '@/pages/Login';
import Register from '@/pages/Register';
import CompleteProfile from '@/pages/CompleteProfile';
import Dashboard from '@/pages/Dashboard';
import CreateMatch from '@/pages/CreateMatch';
import MatchesList from '@/pages/MatchesList';
import MatchDetail from '@/pages/MatchDetail';
import CreateGuest from '@/pages/CreateGuest';
import CreateGroup from '@/pages/CreateGroup';
import GroupDetail from '@/pages/GroupDetail';
import GeneratedTeams from '@/pages/GeneratedTeams';
import PostMatch from '@/pages/PostMatch';
import StatsConfirmation from '@/pages/StatsConfirmation';
import PlayerHistory from '@/pages/PlayerHistory';
import PlayerProfile from '@/pages/PlayerProfile';
import OrganizerPanel from '@/pages/OrganizerPanel';
import AdminPanel from '@/pages/AdminPanel';

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="flex items-center justify-center min-h-screen"><div className="w-8 h-8 border-4 border-turf border-t-transparent rounded-full animate-spin" /></div>;
  if (!isAuthenticated) return <Navigate to="/login" />;
  return children;
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route path="/" element={isAuthenticated ? <Navigate to="/dashboard" /> : <Landing />} />
      <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" /> : <Login />} />
      <Route path="/registro" element={isAuthenticated ? <Navigate to="/dashboard" /> : <Register />} />
      <Route path="/completar-perfil" element={<ProtectedRoute><Layout><CompleteProfile /></Layout></ProtectedRoute>} />
      <Route path="/dashboard" element={<ProtectedRoute><Layout><Dashboard /></Layout></ProtectedRoute>} />
      <Route path="/partidos" element={<ProtectedRoute><Layout><MatchesList /></Layout></ProtectedRoute>} />
      <Route path="/partidos/crear" element={<ProtectedRoute><Layout><CreateMatch /></Layout></ProtectedRoute>} />
      <Route path="/partidos/:id" element={<ProtectedRoute><Layout><MatchDetail /></Layout></ProtectedRoute>} />
      <Route path="/partidos/:id/equipos" element={<ProtectedRoute><Layout><GeneratedTeams /></Layout></ProtectedRoute>} />
      <Route path="/partidos/:id/post-partido" element={<ProtectedRoute><Layout><PostMatch /></Layout></ProtectedRoute>} />
      <Route path="/partidos/:id/estadisticas" element={<ProtectedRoute><Layout><StatsConfirmation /></Layout></ProtectedRoute>} />
      <Route path="/invitar-jugador" element={<ProtectedRoute><Layout><CreateGuest /></Layout></ProtectedRoute>} />
      <Route path="/grupos/crear" element={<ProtectedRoute><Layout><CreateGroup /></Layout></ProtectedRoute>} />
      <Route path="/grupos/:id" element={<ProtectedRoute><Layout><GroupDetail /></Layout></ProtectedRoute>} />
      <Route path="/jugadores/:id" element={<ProtectedRoute><Layout><PlayerProfile /></Layout></ProtectedRoute>} />
      <Route path="/jugadores/:id/historial" element={<ProtectedRoute><Layout><PlayerHistory /></Layout></ProtectedRoute>} />
      <Route path="/mi-perfil" element={<ProtectedRoute><Layout><PlayerProfile isSelf /></Layout></ProtectedRoute>} />
      <Route path="/organizador" element={<ProtectedRoute><Layout><OrganizerPanel /></Layout></ProtectedRoute>} />
      <Route path="/admin" element={<ProtectedRoute><Layout><AdminPanel /></Layout></ProtectedRoute>} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster position="top-center" richColors />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
