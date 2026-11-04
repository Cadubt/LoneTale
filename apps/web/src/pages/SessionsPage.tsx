import { Link, useNavigate } from 'react-router-dom';

import { Badge, Button, EmptyState, ErrorNotice, LoadingBlock, Panel } from '../components/ui';
import { useAbandonSession, useSessions } from '../lib/queries';

const STATUS: Record<string, { label: string; tone: 'gold' | 'moss' | 'blood' | 'neutral' }> = {
  active: { label: 'em andamento', tone: 'gold' },
  completed: { label: 'concluída', tone: 'moss' },
  defeated: { label: 'derrota', tone: 'blood' },
  abandoned: { label: 'abandonada', tone: 'neutral' },
  creating: { label: 'criando', tone: 'neutral' },
};

function formatPlaytime(seconds: number): string {
  if (seconds < 60) {
    return 'menos de um minuto';
  }
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) {
    return `${minutes} min`;
  }
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}min`;
}

export function SessionsPage() {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useSessions();
  const abandon = useAbandonSession();

  if (isLoading) {
    return <LoadingBlock label="Buscando suas partidas…" />;
  }
  if (error) {
    return (
      <ErrorNotice
        message={error instanceof Error ? error.message : 'Falha ao carregar as partidas.'}
        onRetry={() => void refetch()}
      />
    );
  }

  if (!data || data.length === 0) {
    return (
      <EmptyState
        title="Nenhuma partida ainda"
        description="Escolha uma aventura no catálogo, crie seu personagem e comece a sua lenda."
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
      <h1 className="mb-5 font-display text-2xl text-parchment-50">Suas partidas</h1>

      <ul className="space-y-3">
        {data.map((session) => {
          const status = STATUS[session.status] ?? { label: session.status, tone: 'neutral' as const };
          const resumable = session.status === 'active';

          return (
            <li key={session.id}>
              <Panel className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="font-display text-base text-parchment-50">{session.adventureTitle}</h2>
                    <Badge tone={status.tone}>{status.label}</Badge>
                    <Badge>v{session.adventureVersion}</Badge>
                  </div>
                  <p className="mt-1 font-ui text-[13px] text-parchment-300">
                    {session.characterName} · nível {session.characterLevel} ·{' '}
                    {formatPlaytime(session.playtimeSeconds)} de jogo
                  </p>
                  <p className="font-ui text-[11px] text-bronze-500">
                    atualizada em{' '}
                    {new Date(session.updatedAt).toLocaleString('pt-BR', {
                      dateStyle: 'short',
                      timeStyle: 'short',
                    })}
                  </p>
                </div>

                <div className="flex shrink-0 gap-2">
                  <Button
                    variant={resumable ? 'primary' : 'secondary'}
                    onClick={() => navigate(`/jogar/${session.id}`)}
                  >
                    {resumable ? 'Continuar' : 'Rever'}
                  </Button>
                  {resumable && (
                    <Button
                      variant="ghost"
                      loading={abandon.isPending}
                      onClick={() => {
                        if (
                          window.confirm(
                            'Abandonar esta partida? O histórico fica guardado, mas você não poderá continuar de onde parou.',
                          )
                        ) {
                          abandon.mutate(session.id);
                        }
                      }}
                    >
                      Abandonar
                    </Button>
                  )}
                </div>
              </Panel>
            </li>
          );
        })}
      </ul>

      <p className="mt-6 text-center font-ui text-sm text-parchment-400">
        Quer começar outra?{' '}
        <Link to="/aventuras" className="text-gold-300 underline-offset-2 hover:underline">
          Veja o catálogo
        </Link>
        .
      </p>
    </div>
  );
}
