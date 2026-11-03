import { NavLink, Outlet, useNavigate } from 'react-router-dom';

import { api } from '../lib/api-client';
import { selectCanAuthor, useAuthStore } from '../store/auth-store';
import { Button, cx } from './ui';

function NavItem({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        cx(
          'rounded-lg px-3 py-2 font-ui text-sm transition-colors',
          isActive ? 'bg-ink-800 text-ember-300' : 'text-ink-300 hover:bg-ink-800/60 hover:text-ink-100',
        )
      }
    >
      {children}
    </NavLink>
  );
}

export function Layout() {
  const user = useAuthStore((state) => state.user);
  const canAuthor = useAuthStore(selectCanAuthor);
  const navigate = useNavigate();

  const handleLogout = async () => {
    await api.logout();
    navigate('/entrar', { replace: true });
  };

  return (
    <div className="min-h-dvh">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-ember-500 focus:px-4 focus:py-2 focus:text-ink-950"
      >
        Ir para o conteúdo
      </a>

      <header className="sticky top-0 z-40 border-b border-ink-800/80 bg-ink-950/85 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-3 px-4 py-3">
          <NavLink to="/" className="mr-auto flex min-w-0 items-center gap-2.5">
            <span
              aria-hidden="true"
              className="grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-ember-700/60 bg-ember-700/20 font-display text-sm text-ember-300"
            >
              LT
            </span>
            <span className="min-w-0">
              <span className="block truncate font-display text-base leading-tight text-ink-50">
                LoneTale
              </span>
              <span className="hidden truncate font-ui text-[11px] text-ink-400 sm:block">
                Onde você vive sua própria lenda
              </span>
            </span>
          </NavLink>

          <nav className="flex items-center gap-1" aria-label="Navegação principal">
            <NavItem to="/">Catálogo</NavItem>
            {user && <NavItem to="/partidas">Partidas</NavItem>}
            {canAuthor && <NavItem to="/studio">Studio</NavItem>}
          </nav>

          {user ? (
            <div className="ml-2 flex items-center gap-2">
              <span className="hidden max-w-[12ch] truncate font-ui text-xs text-ink-300 sm:block">
                {user.displayName}
              </span>
              <Button size="sm" variant="ghost" onClick={handleLogout}>
                Sair
              </Button>
            </div>
          ) : (
            <Button size="sm" variant="primary" onClick={() => navigate('/entrar')}>
              Entrar
            </Button>
          )}
        </div>
      </header>

      <main id="conteudo" className="mx-auto max-w-6xl px-4 py-6 pb-16">
        <Outlet />
      </main>

      <footer className="border-t border-ink-800/60 py-6">
        <p className="px-4 text-center font-ui text-[11px] text-ink-500">
          LoneTale · ecossistema TavernTale · um jogador, infinitas aventuras
        </p>
      </footer>
    </div>
  );
}
