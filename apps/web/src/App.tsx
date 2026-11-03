import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';

import { Layout } from './components/Layout';
import { LoadingBlock } from './components/ui';
import { restoreSession } from './lib/api-client';
import { AdventureDetailPage } from './pages/AdventureDetailPage';
import { CatalogPage } from './pages/CatalogPage';
import { LoginPage } from './pages/LoginPage';
import { PlayPage } from './pages/PlayPage';
import { SessionsPage } from './pages/SessionsPage';
import { StudioAdventurePage } from './pages/studio/StudioAdventurePage';
import { StudioListPage } from './pages/studio/StudioListPage';
import { selectCanAuthor, useAuthStore } from './store/auth-store';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const authenticated = useAuthStore((state) => Boolean(state.accessToken));
  const restoring = useAuthStore((state) => state.restoring);
  const location = useLocation();

  if (restoring) {
    return <LoadingBlock label="Restaurando sua sessão…" />;
  }
  if (!authenticated) {
    return <Navigate to="/entrar" replace state={{ from: location.pathname }} />;
  }
  return <>{children}</>;
}

function RequireAuthor({ children }: { children: React.ReactNode }) {
  const canAuthor = useAuthStore(selectCanAuthor);
  const restoring = useAuthStore((state) => state.restoring);

  if (restoring) {
    return <LoadingBlock />;
  }
  if (!canAuthor) {
    return (
      <Navigate
        to="/"
        replace
        state={{ notice: 'O Adventure Studio é restrito a autores.' }}
      />
    );
  }
  return <>{children}</>;
}

export default function App() {
  useEffect(() => {
    // Troca o token de renovacao persistido por um token de acesso em memoria.
    void restoreSession();
  }, []);

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route path="/" element={<CatalogPage />} />
        <Route path="/entrar" element={<LoginPage />} />
        <Route path="/aventuras/:slug" element={<AdventureDetailPage />} />
        <Route
          path="/partidas"
          element={
            <RequireAuth>
              <SessionsPage />
            </RequireAuth>
          }
        />
        <Route
          path="/jogar/:sessionId"
          element={
            <RequireAuth>
              <PlayPage />
            </RequireAuth>
          }
        />
        <Route
          path="/studio"
          element={
            <RequireAuth>
              <RequireAuthor>
                <StudioListPage />
              </RequireAuthor>
            </RequireAuth>
          }
        />
        <Route
          path="/studio/:adventureId"
          element={
            <RequireAuth>
              <RequireAuthor>
                <StudioAdventurePage />
              </RequireAuthor>
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
