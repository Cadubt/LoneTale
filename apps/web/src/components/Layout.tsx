import { useEffect, useRef, useState } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';

import { api } from '../lib/api-client';
import { useSessions } from '../lib/queries';
import { selectCanAuthor, useAuthStore } from '../store/auth-store';
import { useUiStore } from '../store/ui-store';
import {
  IconBell,
  IconBook,
  IconChevronDown,
  IconGamepad,
  IconHome,
  IconMenu,
  IconSwords,
  IconUsers,
} from './icons';
import { Portrait } from './ornate';
import { cx } from './ui';

interface NavEntry {
  to: string;
  label: string;
  shortLabel: string;
  icon: (props: { className?: string }) => JSX.Element;
}

const NAV: NavEntry[] = [
  { to: '/', label: 'Início', shortLabel: 'Início', icon: IconHome },
  { to: '/aventuras', label: 'Aventuras', shortLabel: 'Aventuras', icon: IconBook },
  { to: '/personagens', label: 'Meus Personagens', shortLabel: 'Personagens', icon: IconUsers },
  { to: '/partidas', label: 'Minhas Partidas', shortLabel: 'Partidas', icon: IconGamepad },
];

/** Marca do LoneTale: pena sobre o nome, com a assinatura do universo. */
function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <svg viewBox="0 0 24 24" className="h-7 w-7 shrink-0 text-gold-400" aria-hidden="true">
        <path
          d="M19.5 3.2c-7 .4-11.4 4-12.8 8.6-.6 1.9-.5 3.7-.1 5.1L4 20.4l1.3 1.1 2.5-3.2c1.3.4 3 .5 4.8-.1 4.5-1.5 7.4-6.1 6.9-15z"
          fill="currentColor"
          opacity="0.9"
        />
        <path d="M17.6 6.2c-4.2 2.3-7.3 5.6-9.4 10.4" stroke="#2a1c0e" strokeWidth="1.1" fill="none" />
      </svg>
      <span className="min-w-0 leading-tight">
        <span className="block truncate font-display text-xl text-parchment-50 sm:text-2xl">
          LoneTale
        </span>
        {!compact && (
          <span className="block truncate font-sans text-[9px] uppercase tracking-[0.28em] text-bronze-300">
            Um universo TavernTale
          </span>
        )}
      </span>
    </span>
  );
}

function UserMenu() {
  const user = useAuthStore((state) => state.user);
  const canAuthor = useAuthStore(selectCanAuthor);
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const container = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    const close = (event: MouseEvent) => {
      if (container.current && !container.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', close);
    return () => document.removeEventListener('mousedown', close);
  }, [open]);

  if (!user) {
    return (
      <NavLink
        to="/entrar"
        className="tap inline-flex items-center rounded-md border border-bronze-400 bg-gold-choice px-4 font-sans text-sm font-semibold text-sepia-900"
      >
        Entrar
      </NavLink>
    );
  }

  return (
    <div className="relative" ref={container}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
        className="tap flex items-center gap-2 rounded-md px-1.5 text-parchment-100 hover:bg-night-700/70"
      >
        <Portrait name={user.displayName} size="sm" />
        <span className="hidden max-w-[12ch] truncate font-sans text-sm sm:block">
          {user.displayName.split(' ')[0]}
        </span>
        <IconChevronDown className="h-4 w-4 text-bronze-300" />
      </button>

      {open && (
        <div
          role="menu"
          className="rail edge-bronze absolute right-0 z-50 mt-2 w-56 overflow-hidden rounded-lg py-1"
        >
          <p className="border-b border-bronze-600/60 px-3 py-2">
            <span className="block truncate font-sans text-sm text-parchment-100">
              {user.displayName}
            </span>
            <span className="block truncate font-sans text-[11px] text-parchment-400">
              {user.email}
            </span>
          </p>
          {canAuthor && (
            <button
              role="menuitem"
              type="button"
              className="tap w-full px-3 text-left font-sans text-sm text-parchment-200 hover:bg-night-600"
              onClick={() => {
                setOpen(false);
                navigate('/studio');
              }}
            >
              Adventure Studio
            </button>
          )}
          <button
            role="menuitem"
            type="button"
            className="tap w-full px-3 text-left font-sans text-sm text-parchment-200 hover:bg-night-600"
            onClick={async () => {
              setOpen(false);
              await api.logout();
              navigate('/entrar', { replace: true });
            }}
          >
            Sair
          </button>
        </div>
      )}
    </div>
  );
}

/**
 * Sino de avisos.
 *
 * Mostra apenas o que existe de verdade: pontos de atributo esperando
 * distribuicao depois de subir de nivel. Sem nada pendente, nao ha selo.
 */
function Notifications({ pending }: { pending: number }) {
  return (
    <button
      type="button"
      className="tap relative grid w-11 place-items-center rounded-md text-parchment-200 hover:bg-night-700/70"
      aria-label={
        pending > 0
          ? `${pending} ponto(s) de atributo para distribuir`
          : 'Nenhum aviso'
      }
      title={pending > 0 ? 'Você tem pontos de atributo para distribuir' : 'Nenhum aviso'}
    >
      <IconBell className="h-5 w-5" />
      {pending > 0 && (
        <span className="absolute right-1.5 top-1.5 grid h-4 min-w-[16px] place-items-center rounded-full border border-blood-700 bg-blood-500 px-1 font-sans text-[10px] font-bold text-parchment-50">
          {pending}
        </span>
      )}
    </button>
  );
}

export function Layout() {
  const authenticated = useAuthStore((state) => Boolean(state.accessToken));
  const location = useLocation();
  const [drawerOpen, setDrawerOpen] = useState(false);

  const sessions = useSessions({ enabled: authenticated });
  const activeSession = sessions.data?.find((entry) => entry.status === 'active');
  const pendingPoints = useUiStore((state) => state.pendingAttributePoints);

  // O botao central "Jogar" leva a partida em andamento, se houver.
  const playTarget = activeSession
    ? `/jogar/${activeSession.id}`
    : authenticated
      ? '/partidas'
      : '/aventuras';

  useEffect(() => {
    setDrawerOpen(false);
  }, [location.pathname]);

  const isPlaying = location.pathname.startsWith('/jogar/');

  return (
    <div className="flex min-h-dvh flex-col">
      <a
        href="#conteudo"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-[60] focus:rounded-md focus:bg-gold-400 focus:px-4 focus:py-2 focus:text-sepia-900"
      >
        Ir para o conteúdo
      </a>

      {/* ------------------------------------------------------ barra superior */}
      <header className="sticky top-0 z-40 border-b border-bronze-600 banner-strip backdrop-blur">
        <div className="mx-auto flex h-[60px] max-w-[1600px] items-center gap-3 px-3 sm:h-[72px] sm:px-5">
          <button
            type="button"
            onClick={() => setDrawerOpen((value) => !value)}
            aria-label="Abrir menu"
            aria-expanded={drawerOpen}
            className="tap grid w-11 place-items-center rounded-md text-parchment-200 hover:bg-night-700/70 lg:hidden"
          >
            <IconMenu className="h-6 w-6" />
          </button>

          <NavLink to="/" className="mr-auto min-w-0 lg:mr-6">
            <Brand />
          </NavLink>

          <nav className="hidden items-center gap-1 lg:flex" aria-label="Navegação principal">
            {NAV.map((entry) => {
              const Icon = entry.icon;
              return (
                <NavLink
                  key={entry.to}
                  to={entry.to}
                  end={entry.to === '/'}
                  className={({ isActive }) =>
                    cx(
                      'tap flex items-center gap-2 rounded-md px-3 font-display text-[0.95rem] transition-colors',
                      isActive
                        ? 'bg-night-700 text-gold-300 shadow-gold'
                        : 'text-parchment-200 hover:bg-night-700/60 hover:text-parchment-50',
                    )
                  }
                >
                  <Icon className="h-5 w-5" />
                  {entry.label}
                </NavLink>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-1 lg:ml-6">
            {authenticated && <Notifications pending={pendingPoints} />}
            <UserMenu />
          </div>
        </div>

        {/* gaveta do celular */}
        {drawerOpen && (
          <nav
            className="border-t border-bronze-600/70 bg-night-900/95 px-3 py-2 lg:hidden"
            aria-label="Navegação"
          >
            {NAV.map((entry) => {
              const Icon = entry.icon;
              return (
                <NavLink
                  key={entry.to}
                  to={entry.to}
                  end={entry.to === '/'}
                  className={({ isActive }) =>
                    cx(
                      'tap flex items-center gap-3 rounded-md px-3 font-display text-base',
                      isActive ? 'bg-night-700 text-gold-300' : 'text-parchment-200',
                    )
                  }
                >
                  <Icon className="h-5 w-5" />
                  {entry.label}
                </NavLink>
              );
            })}
          </nav>
        )}
      </header>

      {/* ------------------------------------------------------------ conteudo */}
      <main
        id="conteudo"
        className={cx(
          'mx-auto w-full max-w-[1600px] flex-1 px-3 pt-4 sm:px-5',
          // espaco para a barra de abas fixa no celular
          'pb-28 lg:pb-10',
          isPlaying ? 'sm:pt-4' : 'sm:pt-6',
        )}
      >
        <Outlet />
      </main>

      <footer className="hidden border-t border-bronze-700/60 py-5 lg:block">
        <p className="text-center font-sans text-[11px] text-bronze-500">
          LoneTale · ecossistema TavernTale · um jogador, infinitas aventuras
        </p>
      </footer>

      {/* -------------------------------------------- barra de abas do celular */}
      <nav
        className="fixed inset-x-0 bottom-0 z-40 border-t border-bronze-600 banner-strip pb-[env(safe-area-inset-bottom)] lg:hidden"
        aria-label="Navegação rápida"
      >
        <div className="mx-auto grid max-w-lg grid-cols-5 items-end px-1 pt-1.5">
          {[NAV[0], NAV[1]].map((entry) => (
            <TabLink key={entry!.to} entry={entry!} />
          ))}

          <NavLink
            to={playTarget}
            className={({ isActive }) =>
              cx(
                'mx-auto -mt-5 grid h-[58px] w-[58px] place-items-center rounded-full border-2 transition-colors',
                isActive || isPlaying
                  ? 'border-gold-300 bg-gold-choice text-sepia-900 shadow-gold'
                  : 'border-bronze-400 bg-night-700 text-gold-300',
              )
            }
            aria-label="Jogar"
          >
            <span className="grid place-items-center">
              <IconSwords className="h-6 w-6" />
              <span className="font-display text-[10px] leading-none">Jogar</span>
            </span>
          </NavLink>

          {[NAV[2], NAV[3]].map((entry) => (
            <TabLink key={entry!.to} entry={entry!} />
          ))}
        </div>
      </nav>
    </div>
  );
}

function TabLink({ entry }: { entry: NavEntry }) {
  const Icon = entry.icon;
  return (
    <NavLink
      to={entry.to}
      end={entry.to === '/'}
      className={({ isActive }) =>
        cx(
          'flex min-h-[56px] flex-col items-center justify-center gap-1 rounded-md px-1 py-1 text-center',
          isActive ? 'text-gold-300' : 'text-parchment-300',
        )
      }
    >
      <Icon className="h-5 w-5" />
      <span className="font-display text-[10px] leading-tight">{entry.shortLabel}</span>
    </NavLink>
  );
}
