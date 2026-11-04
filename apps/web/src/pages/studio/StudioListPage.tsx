import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

import {
  Badge,
  Button,
  EmptyState,
  ErrorNotice,
  LoadingBlock,
  Panel,
  PanelTitle,
  cx,
} from '../../components/ui';
import { ApiError } from '../../lib/api-client';
import {
  useImportAdventure,
  useStudioAdventures,
  useValidateDocument,
  type ValidationIssue,
} from '../../lib/queries';

function IssueList({ issues, tone }: { issues: ValidationIssue[]; tone: 'error' | 'warning' }) {
  if (issues.length === 0) {
    return null;
  }
  return (
    <div className="mt-3">
      <h3
        className={cx(
          'mb-1 font-display text-xs uppercase tracking-[0.18em]',
          tone === 'error' ? 'text-blood-400' : 'text-ember-300',
        )}
      >
        {tone === 'error' ? `${issues.length} erro(s)` : `${issues.length} aviso(s)`}
      </h3>
      <ul className="scrollbar-thin max-h-56 space-y-1 overflow-y-auto pr-1">
        {issues.map((issue, index) => (
          <li key={index} className="font-ui text-[12px]">
            <code className="text-parchment-400">{issue.path}</code>{' '}
            <span className={tone === 'error' ? 'text-blood-400' : 'text-parchment-200'}>
              {issue.message}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function StudioListPage() {
  const navigate = useNavigate();
  const { data, isLoading, error, refetch } = useStudioAdventures();
  const validate = useValidateDocument();
  const importAdventure = useImportAdventure();

  const [raw, setRaw] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [publishNow, setPublishNow] = useState(false);

  const parse = (): Record<string, unknown> | null => {
    setParseError(null);
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
        setParseError('O documento deve ser um objeto JSON.');
        return null;
      }
      return parsed as Record<string, unknown>;
    } catch (caught) {
      setParseError(`JSON inválido: ${(caught as Error).message}`);
      return null;
    }
  };

  const handleFile = async (file: File) => {
    const text = await file.text();
    setRaw(text);
    validate.reset();
    importAdventure.reset();
  };

  const validation = validate.data;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="font-display text-2xl text-parchment-50">Adventure Studio</h1>
        <p className="mt-1 max-w-2xl font-ui text-sm text-parchment-300">
          Aventuras são documentos JSON. Nenhuma história exige alterar o código da plataforma: você
          valida, grava e publica — e a versão publicada vira imutável.
        </p>
      </header>

      <Panel>
        <PanelTitle hint="valide antes de importar">Importar aventura</PanelTitle>

        <div className="flex flex-wrap gap-2">
          <label className="inline-flex min-h-[44px] cursor-pointer items-center rounded-lg border border-night-700 bg-night-800/80 px-4 font-ui text-sm text-parchment-100 hover:bg-night-700/80">
            Escolher arquivo .json
            <input
              type="file"
              accept="application/json,.json"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) {
                  void handleFile(file);
                }
              }}
            />
          </label>
          <Button
            variant="secondary"
            onClick={() => {
              const parsed = parse();
              if (parsed) {
                validate.mutate(parsed);
              }
            }}
            loading={validate.isPending}
            disabled={raw.trim().length === 0}
          >
            Validar
          </Button>
        </div>

        <label htmlFor="documento" className="mb-1 mt-4 block font-ui text-xs text-parchment-300">
          Documento
        </label>
        <textarea
          id="documento"
          value={raw}
          onChange={(event) => {
            setRaw(event.target.value);
            setParseError(null);
          }}
          rows={10}
          spellCheck={false}
          placeholder='{ "schemaVersion": "1.0.0", "metadata": { … } }'
          className="scrollbar-thin w-full resize-y rounded-lg border border-night-700 bg-night-950/80 px-3 py-2.5 font-mono text-[12px] leading-relaxed text-parchment-100 focus:border-ember-500 focus:outline-none"
        />

        {parseError && <p className="mt-2 font-ui text-[13px] text-blood-400">{parseError}</p>}

        {validation && (
          <div
            className={cx(
              'mt-3 rounded-lg border px-3 py-2.5',
              validation.valid
                ? 'border-moss-600/50 bg-moss-600/10'
                : 'border-blood-600/50 bg-blood-600/10',
            )}
          >
            <p className="font-ui text-sm">
              {validation.valid
                ? 'O documento passou na validação do contrato.'
                : 'O documento não pode ser importado ainda.'}
            </p>
            <IssueList issues={validation.errors} tone="error" />
            <IssueList issues={validation.warnings} tone="warning" />
          </div>
        )}

        {importAdventure.error && (
          <div className="mt-3">
            <ErrorNotice
              title="Falha ao importar"
              message={
                importAdventure.error instanceof ApiError
                  ? importAdventure.error.message
                  : 'Erro inesperado.'
              }
            />
          </div>
        )}

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 font-ui text-sm text-parchment-200">
            <input
              type="checkbox"
              checked={publishNow}
              onChange={(event) => setPublishNow(event.target.checked)}
              className="h-4 w-4 accent-ember-500"
            />
            Publicar como pública depois de importar
          </label>

          <Button
            variant="primary"
            className="ml-auto"
            loading={importAdventure.isPending}
            disabled={!validation?.valid}
            onClick={() => {
              const parsed = parse();
              if (!parsed) {
                return;
              }
              importAdventure.mutate(
                {
                  document: parsed,
                  publish: publishNow,
                  visibility: publishNow ? 'public' : 'private',
                },
                {
                  onSuccess: (result) => {
                    setRaw('');
                    validate.reset();
                    navigate(`/studio/${result.adventureId}`);
                  },
                },
              );
            }}
          >
            Importar
          </Button>
        </div>
      </Panel>

      <section>
        <h2 className="mb-3 font-display text-lg text-parchment-50">Suas aventuras</h2>

        {isLoading && <LoadingBlock />}
        {error && (
          <ErrorNotice
            message={error instanceof Error ? error.message : 'Falha ao carregar.'}
            onRetry={() => void refetch()}
          />
        )}

        {data && data.length === 0 && (
          <EmptyState
            title="Nenhuma aventura ainda"
            description="Importe um documento JSON acima. Há um exemplo completo em examples/adventures/a-ponte-quebrada.json no repositório."
          />
        )}

        {data && data.length > 0 && (
          <ul className="space-y-3">
            {data.map((adventure) => (
              <li key={adventure.id}>
                <Panel className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-display text-base text-parchment-50">{adventure.title}</h3>
                      <Badge
                        tone={
                          adventure.status === 'published'
                            ? 'moss'
                            : adventure.status === 'archived'
                              ? 'neutral'
                              : 'gold'
                        }
                      >
                        {adventure.status === 'published'
                          ? 'publicada'
                          : adventure.status === 'archived'
                            ? 'arquivada'
                            : 'rascunho'}
                      </Badge>
                      {adventure.publishedVersion && (
                        <Badge tone="arcane">v{adventure.publishedVersion} no ar</Badge>
                      )}
                      {adventure.draftVersion && <Badge>v{adventure.draftVersion} em edição</Badge>}
                    </div>
                    <p className="font-ui text-[12px] text-parchment-400">{adventure.slug}</p>
                  </div>
                  <Button variant="secondary" onClick={() => navigate(`/studio/${adventure.id}`)}>
                    Abrir
                  </Button>
                </Panel>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
