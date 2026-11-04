import { Link, useNavigate } from 'react-router-dom';

import { IconBook, IconGamepad, IconSwords } from '../components/icons';
import { OrnateDivider, OrnateFrame, ParchmentPanel, Portrait } from '../components/ornate';
import { Badge, Button, LoadingBlock, cx } from '../components/ui';
import { useCatalog, useSessions, type CatalogEntry } from '../lib/queries';
import { useAuthStore } from '../store/auth-store';

function FeaturedCard({ entry }: { entry: CatalogEntry }) {
  return (
    <Link
      to={`/aventuras/${entry.slug}`}
      className="group block focus-visible:outline-2"
      aria-label={`Abrir ${entry.title}`}
    >
      <OrnateFrame className="overflow-hidden transition-all group-hover:shadow-gold">
        <div className="relative aspect-[16/9] overflow-hidden bg-night-800">
          {entry.coverImageSrc ? (
            <img
              src={entry.coverImageSrc}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            />
          ) : (
            <span className="grid h-full w-full place-items-center font-display text-4xl text-bronze-600">
              {entry.title.slice(0, 1)}
            </span>
          )}
          <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-night-950 via-night-950/70 to-transparent p-3">
            <h3 className="font-display text-lg leading-tight text-parchment-50">{entry.title}</h3>
          </div>
        </div>

        <div className="rail p-3">
          {entry.summary && (
            <p className="line-clamp-2 font-sans text-[13px] text-parchment-300">{entry.summary}</p>
          )}
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            <Badge tone="gold">v{entry.version}</Badge>
            {entry.estimatedMinutes !== undefined && <Badge>{entry.estimatedMinutes} min</Badge>}
            {entry.genre.slice(0, 2).map((genre) => (
              <Badge key={genre} tone="arcane">
                {genre}
              </Badge>
            ))}
          </div>
        </div>
      </OrnateFrame>
    </Link>
  );
}

export function HomePage() {
  const navigate = useNavigate();
  const authenticated = useAuthStore((state) => Boolean(state.accessToken));
  const user = useAuthStore((state) => state.user);
  const catalog = useCatalog('', '');
  const sessions = useSessions({ enabled: authenticated });

  const featured = catalog.data?.items.slice(0, 3) ?? [];
  const active = (sessions.data ?? []).filter((entry) => entry.status === 'active').slice(0, 3);

  return (
    <div className="space-y-8">
      {/* ------------------------------------------------------------- hero */}
      <ParchmentPanel bodyClassName="px-5 py-8 sm:px-10 sm:py-12 text-center">
        <p className="font-sans text-[11px] uppercase tracking-[0.3em] text-sepia-500">
          Um universo TavernTale
        </p>
        <h1 className="mt-2 font-display text-3xl text-blood-700 sm:text-5xl">LoneTale</h1>
        <p className="mt-1 font-display text-lg text-sepia-600 sm:text-2xl">
          Onde você vive sua própria lenda
        </p>

        <OrnateDivider className="mx-auto my-5 max-w-sm" />

        <p className="mx-auto max-w-xl font-body text-[1.0625rem] text-sepia-700">
          Um jogador. Infinitas aventuras. Incontáveis destinos. Você lê a situação, decide, e a
          história responde — com as suas escolhas, o seu personagem e as consequências que vierem.
        </p>

        <div className="mt-6 flex flex-wrap justify-center gap-3">
          <Button variant="primary" size="lg" onClick={() => navigate('/aventuras')}>
            <IconBook className="h-5 w-5" />
            Ver o catálogo
          </Button>
          {authenticated ? (
            <Button variant="parchment" size="lg" onClick={() => navigate('/partidas')}>
              <IconGamepad className="h-5 w-5" />
              Minhas partidas
            </Button>
          ) : (
            <Button variant="parchment" size="lg" onClick={() => navigate('/entrar')}>
              Entrar ou criar conta
            </Button>
          )}
        </div>
      </ParchmentPanel>

      {/* -------------------------------------------- continuar de onde parou */}
      {authenticated && active.length > 0 && (
        <section>
          <h2 className="mb-3 font-display text-xl text-parchment-50">
            Continue de onde parou{user ? `, ${user.displayName.split(' ')[0]}` : ''}
          </h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {active.map((session) => (
              <li key={session.id}>
                <OrnateFrame className="overflow-hidden">
                  <div className="rail flex items-center gap-3 p-3">
                    <Portrait name={session.characterName} size="md" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-display text-[0.95rem] text-parchment-50">
                        {session.characterName}
                      </p>
                      <p className="truncate font-sans text-[12px] text-parchment-400">
                        {session.adventureTitle} · nível {session.characterLevel}
                      </p>
                    </div>
                    <Button
                      size="sm"
                      variant="primary"
                      onClick={() => navigate(`/jogar/${session.id}`)}
                    >
                      <IconSwords className="h-4 w-4" />
                      Jogar
                    </Button>
                  </div>
                </OrnateFrame>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ------------------------------------------------ aventuras em destaque */}
      <section>
        <div className="mb-3 flex items-baseline justify-between gap-3">
          <h2 className="font-display text-xl text-parchment-50">Aventuras em destaque</h2>
          <Link
            to="/aventuras"
            className="font-sans text-sm text-gold-300 underline-offset-2 hover:underline"
          >
            ver todas
          </Link>
        </div>

        {catalog.isLoading && <LoadingBlock label="Abrindo o catálogo…" />}

        {!catalog.isLoading && featured.length === 0 && (
          <OrnateFrame>
            <div className="rail px-6 py-10 text-center">
              <p className="font-sans text-sm text-parchment-300">
                Nenhuma aventura publicada ainda. Se você é autor, o Adventure Studio importa um JSON
                e publica em poucos passos.
              </p>
            </div>
          </OrnateFrame>
        )}

        {featured.length > 0 && (
          <ul className={cx('grid gap-4', featured.length > 1 ? 'sm:grid-cols-2 lg:grid-cols-3' : '')}>
            {featured.map((entry) => (
              <li key={entry.adventureId}>
                <FeaturedCard entry={entry} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
