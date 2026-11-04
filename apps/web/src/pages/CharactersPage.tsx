import { useNavigate } from 'react-router-dom';

import { IconGamepad, IconSwords } from '../components/icons';
import { OrnateFrame, Portrait } from '../components/ornate';
import { Badge, Button, EmptyState, ErrorNotice, LoadingBlock } from '../components/ui';
import { useSessions } from '../lib/queries';

const STATUS: Record<string, { label: string; tone: 'gold' | 'moss' | 'blood' | 'neutral' }> = {
  active: { label: 'em jogo', tone: 'gold' },
  completed: { label: 'concluída', tone: 'moss' },
  defeated: { label: 'tombou', tone: 'blood' },
  abandoned: { label: 'abandonada', tone: 'neutral' },
};

/**
 * Meus Personagens.
 *
 * Cada personagem nasce dentro de uma partida e fica preso a versao da
 * aventura em que foi criado, entao a lista e montada a partir das partidas --
 * nao existe personagem solto, sem historia.
 */
export function CharactersPage() {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useSessions();

  if (isLoading) {
    return <LoadingBlock label="Reunindo seus personagens…" />;
  }
  if (error) {
    return (
      <ErrorNotice
        message={error instanceof Error ? error.message : 'Falha ao carregar.'}
        onRetry={() => void refetch()}
      />
    );
  }
  if (!data || data.length === 0) {
    return (
      <EmptyState
        title="Nenhum personagem ainda"
        description="Escolha uma aventura no catálogo: o personagem é criado junto com a partida, com as classes, espécies e atributos que aquela história permitir."
        action={
          <Button variant="primary" onClick={() => navigate('/aventuras')}>
            Ver o catálogo
          </Button>
        }
      />
    );
  }

  return (
    <div>
      <h1 className="mb-1 font-display text-2xl text-parchment-50">Meus personagens</h1>
      <p className="mb-5 font-sans text-sm text-parchment-400">
        Cada personagem pertence à aventura e à versão em que foi criado.
      </p>

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {data.map((session) => {
          const status = STATUS[session.status] ?? { label: session.status, tone: 'neutral' as const };
          const playable = session.status === 'active';

          return (
            <li key={session.id}>
              <OrnateFrame className="h-full overflow-hidden">
                <div className="rail flex h-full flex-col gap-3 p-4">
                  <div className="flex items-center gap-3">
                    <Portrait name={session.characterName} size="lg" />
                    <div className="min-w-0">
                      <h2 className="truncate font-display text-lg text-parchment-50">
                        {session.characterName}
                      </h2>
                      <p className="font-sans text-[12px] text-parchment-400">
                        Nível {session.characterLevel}
                      </p>
                      <Badge tone={status.tone} className="mt-1">
                        {status.label}
                      </Badge>
                    </div>
                  </div>

                  <dl className="space-y-1 font-sans text-[12px] text-parchment-300">
                    <div className="flex justify-between gap-2">
                      <dt>Aventura</dt>
                      <dd className="truncate text-parchment-100">{session.adventureTitle}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt>Versão</dt>
                      <dd className="tabular-nums text-parchment-100">v{session.adventureVersion}</dd>
                    </div>
                    <div className="flex justify-between gap-2">
                      <dt>Criado em</dt>
                      <dd className="text-parchment-100">
                        {new Date(session.startedAt).toLocaleDateString('pt-BR')}
                      </dd>
                    </div>
                  </dl>

                  <Button
                    variant={playable ? 'primary' : 'secondary'}
                    block
                    className="mt-auto"
                    onClick={() => navigate(`/jogar/${session.id}`)}
                  >
                    {playable ? <IconSwords className="h-4 w-4" /> : <IconGamepad className="h-4 w-4" />}
                    {playable ? 'Continuar' : 'Rever a jornada'}
                  </Button>
                </div>
              </OrnateFrame>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
