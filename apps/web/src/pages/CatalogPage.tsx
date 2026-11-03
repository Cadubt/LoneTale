import { useState } from 'react';
import { Link } from 'react-router-dom';

import { Badge, EmptyState, ErrorNotice, LoadingBlock, Panel, cx } from '../components/ui';
import { useCatalog, type CatalogEntry } from '../lib/queries';

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: 'tranquila',
  normal: 'equilibrada',
  hard: 'difícil',
  brutal: 'brutal',
};

function AdventureCard({ entry }: { entry: CatalogEntry }) {
  return (
    <Link
      to={`/aventuras/${entry.slug}`}
      className={cx(
        'group block overflow-hidden rounded-xl border border-ink-800 bg-ink-900/60 transition-all',
        'hover:border-ember-600/50 hover:shadow-glow focus-visible:border-ember-500',
      )}
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-ink-800">
        {entry.coverImageSrc ? (
          <img
            src={entry.coverImageSrc}
            alt=""
            loading="lazy"
            className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]"
            onError={(event) => {
              event.currentTarget.style.display = 'none';
            }}
          />
        ) : (
          <div
            aria-hidden="true"
            className="grid h-full w-full place-items-center font-display text-3xl text-ink-700"
          >
            {entry.title.slice(0, 1)}
          </div>
        )}
      </div>

      <div className="p-4">
        <h2 className="font-display text-base leading-snug text-ink-50">{entry.title}</h2>
        {entry.summary && (
          <p className="mt-1.5 line-clamp-3 font-ui text-[13px] text-ink-300">{entry.summary}</p>
        )}

        <div className="mt-3 flex flex-wrap gap-1.5">
          <Badge tone="ember">v{entry.version}</Badge>
          {entry.difficulty && (
            <Badge>{DIFFICULTY_LABELS[entry.difficulty] ?? entry.difficulty}</Badge>
          )}
          {entry.estimatedMinutes !== undefined && <Badge>{entry.estimatedMinutes} min</Badge>}
          {entry.genre.slice(0, 2).map((genre) => (
            <Badge key={genre} tone="arcane">
              {genre}
            </Badge>
          ))}
        </div>
      </div>
    </Link>
  );
}

export function CatalogPage() {
  const [search, setSearch] = useState('');
  const { data, isLoading, error, refetch } = useCatalog(search, '');

  return (
    <div>
      <section className="mb-7">
        <h1 className="font-display text-2xl text-ink-50 sm:text-3xl">Escolha sua lenda</h1>
        <p className="mt-1.5 max-w-2xl font-ui text-sm text-ink-300">
          Cada aventura traz seu próprio mundo, suas próprias regras e seus próprios destinos. Você
          lê a situação, decide, e a história responde.
        </p>
      </section>

      <Panel className="mb-6">
        <label htmlFor="busca" className="mb-1 block font-ui text-xs text-ink-300">
          Buscar
        </label>
        <input
          id="busca"
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Título ou resumo…"
          className="w-full rounded-lg border border-ink-700 bg-ink-900/70 px-3 py-2.5 font-ui text-sm text-ink-50 placeholder:text-ink-500 focus:border-ember-500 focus:outline-none"
        />
      </Panel>

      {isLoading && <LoadingBlock label="Abrindo o catálogo…" />}

      {error && (
        <ErrorNotice
          message={error instanceof Error ? error.message : 'Falha ao carregar o catálogo.'}
          onRetry={() => void refetch()}
        />
      )}

      {data && data.items.length === 0 && (
        <EmptyState
          title="Nenhuma aventura publicada"
          description={
            search
              ? 'Nada corresponde a essa busca. Tente outras palavras.'
              : 'Assim que um autor publicar uma aventura, ela aparece aqui. Se você é autor, abra o Adventure Studio e importe um JSON.'
          }
        />
      )}

      {data && data.items.length > 0 && (
        <ul className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {data.items.map((entry) => (
            <li key={entry.adventureId}>
              <AdventureCard entry={entry} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
