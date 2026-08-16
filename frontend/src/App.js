import React, { Suspense, lazy } from 'react';
import '@/App.css';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/contexts/AuthContext';
import { Toaster } from '@/components/ui/sonner';
import Layout from '@/components/Layout';
import PageLoader from '@/components/common/PageLoader';

// Estáticas a propósito: son el primer paint del usuario no autenticado.
// Meterlas en un chunk aparte le agrega un round-trip y un spinner a la
// pantalla de entrada, justo lo que no queremos desde el celular.
import Landing from '@/pages/Landing';
import Login from '@/pages/Login';

// El resto va lazy: cada una es su propio chunk y sólo se baja cuando se navega.
const Register = lazy(() => import('@/pages/Register'));
const VerifyEmail = lazy(() => import('@/pages/VerifyEmail'));
const CompleteProfile = lazy(() => import('@/pages/CompleteProfile'));
const Dashboard = lazy(() => import('@/pages/Dashboard'));
const CreateMatch = lazy(() => import('@/pages/CreateMatch'));
const MatchesList = lazy(() => import('@/pages/MatchesList'));
const MatchDetail = lazy(() => import('@/pages/MatchDetail'));
const CreateGuest = lazy(() => import('@/pages/CreateGuest'));
const CreateGroup = lazy(() => import('@/pages/CreateGroup'));
const GroupDetail = lazy(() => import('@/pages/GroupDetail'));
const GeneratedTeams = lazy(() => import('@/pages/GeneratedTeams'));
const PostMatch = lazy(() => import('@/pages/PostMatch'));
const StatsConfirmation = lazy(() => import('@/pages/StatsConfirmation'));
const PlayerHistory = lazy(() => import('@/pages/PlayerHistory'));
const PlayerProfile = lazy(() => import('@/pages/PlayerProfile'));
const OrganizerPanel = lazy(() => import('@/pages/OrganizerPanel'));
const AdminPanel = lazy(() => import('@/pages/AdminPanel'));

function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <div className="min-h-screen"><PageLoader label="Preparando tu sesión..." /></div>;
  if (!isAuthenticated) return <Navigate to="/login" />;
  return children;
}

// Página con shell: el Suspense va ADENTRO del Layout, así el header y la
// bottom nav quedan montados mientras baja el chunk de la página. Si el
// Suspense envolviera al Layout, cada navegación haría parpadear toda la app.
function ProtectedPage({ children }) {
  return (
    <ProtectedRoute>
      <Layout>
        <Suspense fallback={<PageLoader />}>{children}</Suspense>
      </Layout>
    </ProtectedRoute>
  );
}

// Páginas públicas lazy (no tienen Layout): el fallback ocupa la pantalla.
function PublicPage({ children }) {
  return (
    <Suspense fallback={<div className="min-h-screen"><PageLoader /></div>}>
      {children}
    </Suspense>
  );
}

function AppRoutes() {
  const { isAuthenticated } = useAuth();

  return (
    <Routes>
      <Route path="/" element={isAuthenticated ? <Navigate to="/dashboard" /> : <Landing />} />
      <Route path="/login" element={isAuthenticated ? <Navigate to="/dashboard" /> : <Login />} />
      <Route path="/registro" element={isAuthenticated ? <Navigate to="/dashboard" /> : <PublicPage><Register /></PublicPage>} />
      <Route path="/verificar-email" element={<PublicPage><VerifyEmail /></PublicPage>} />
      <Route path="/completar-perfil" element={<ProtectedPage><CompleteProfile /></ProtectedPage>} />
      <Route path="/dashboard" element={<ProtectedPage><Dashboard /></ProtectedPage>} />
      <Route path="/partidos" element={<ProtectedPage><MatchesList /></ProtectedPage>} />
      <Route path="/partidos/crear" element={<ProtectedPage><CreateMatch /></ProtectedPage>} />
      <Route path="/partidos/:id" element={<ProtectedPage><MatchDetail /></ProtectedPage>} />
      <Route path="/partidos/:id/equipos" element={<ProtectedPage><GeneratedTeams /></ProtectedPage>} />
      <Route path="/partidos/:id/post-partido" element={<ProtectedPage><PostMatch /></ProtectedPage>} />
      <Route path="/partidos/:id/estadisticas" element={<ProtectedPage><StatsConfirmation /></ProtectedPage>} />
      <Route path="/invitar-jugador" element={<ProtectedPage><CreateGuest /></ProtectedPage>} />
      <Route path="/grupos/crear" element={<ProtectedPage><CreateGroup /></ProtectedPage>} />
      <Route path="/grupos/:id" element={<ProtectedPage><GroupDetail /></ProtectedPage>} />
      <Route path="/jugadores/:id" element={<ProtectedPage><PlayerProfile /></ProtectedPage>} />
      <Route path="/jugadores/:id/historial" element={<ProtectedPage><PlayerHistory /></ProtectedPage>} />
      <Route path="/mi-perfil" element={<ProtectedPage><PlayerProfile isSelf /></ProtectedPage>} />
      <Route path="/organizador" element={<ProtectedPage><OrganizerPanel /></ProtectedPage>} />
      <Route path="/admin" element={<ProtectedPage><AdminPanel /></ProtectedPage>} />
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
        <Toaster position="top-center" richColors containerAriaLabel="Notificaciones" />
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
