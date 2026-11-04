import { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';

import { Button, ErrorNotice, LoadingBlock, Panel, cx } from '../components/ui';
import { ApiError, api } from '../lib/api-client';
import { useAuthStore } from '../store/auth-store';

const FLOW_TOKEN_KEY = 'lonetale.googleFlowToken';

type Mode = 'login' | 'register';

function Field({
  label,
  hint,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { label: string; hint?: string }) {
  const id = `field-${props.name}`;
  return (
    <div>
      <label htmlFor={id} className="mb-1 block font-ui text-xs text-parchment-300">
        {label}
      </label>
      <input
        {...props}
        id={id}
        className={cx(
          'w-full rounded-lg border border-night-700 bg-night-900/70 px-3 py-2.5 font-ui text-sm text-parchment-50',
          'placeholder:text-bronze-500 focus:border-ember-500 focus:outline-none',
        )}
      />
      {hint && <p className="mt-1 font-ui text-[11px] text-parchment-400">{hint}</p>}
    </div>
  );
}

export function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const setSession = useAuthStore((state) => state.setSession);
  const authenticated = useAuthStore((state) => Boolean(state.accessToken));

  const [mode, setMode] = useState<Mode>('login');
  const [email, setEmail] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [completingGoogle, setCompletingGoogle] = useState(false);

  const redirectTo = (location.state as { from?: string } | null)?.from ?? '/';

  useEffect(() => {
    if (authenticated && !completingGoogle) {
      navigate(redirectTo, { replace: true });
    }
  }, [authenticated, completingGoogle, navigate, redirectTo]);

  // Retorno do Google: troca o codigo pela sessao.
  useEffect(() => {
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    if (!code || !state) {
      return;
    }

    const flowToken = sessionStorage.getItem(FLOW_TOKEN_KEY);
    if (!flowToken) {
      setError('O fluxo de login expirou. Tente entrar com o Google novamente.');
      setSearchParams({}, { replace: true });
      return;
    }

    setCompletingGoogle(true);
    api
      .googleCallback(code, state, flowToken)
      .then((session) => {
        sessionStorage.removeItem(FLOW_TOKEN_KEY);
        setSession(session);
        setSearchParams({}, { replace: true });
        navigate('/', { replace: true });
      })
      .catch((caught: unknown) => {
        setError(caught instanceof ApiError ? caught.message : 'Nao foi possivel concluir o login.');
        setSearchParams({}, { replace: true });
      })
      .finally(() => setCompletingGoogle(false));
  }, [navigate, searchParams, setSearchParams, setSession]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const session =
        mode === 'login'
          ? await api.login(email, password)
          : await api.register(email, displayName, password);
      setSession(session);
      navigate(redirectTo, { replace: true });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : 'Falha inesperada. Tente de novo.');
    } finally {
      setBusy(false);
    }
  };

  const startGoogle = async () => {
    setError(null);
    try {
      const request = await api.googleUrl();
      sessionStorage.setItem(FLOW_TOKEN_KEY, request.flowToken);
      window.location.assign(request.authorizationUrl);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : 'Login com Google indisponível nesta instalação.',
      );
    }
  };

  if (completingGoogle) {
    return <LoadingBlock label="Concluindo o login com o Google…" />;
  }

  return (
    <div className="mx-auto max-w-md">
      <h1 className="mb-1 text-center font-display text-2xl text-parchment-50">
        {mode === 'login' ? 'Entre na taverna' : 'Crie sua conta'}
      </h1>
      <p className="mb-6 text-center font-ui text-sm text-parchment-400">
        Um jogador. Infinitas aventuras. Incontáveis destinos.
      </p>

      {error && (
        <div className="mb-4">
          <ErrorNotice title="Não foi possível entrar" message={error} />
        </div>
      )}

      <Panel>
        <form onSubmit={submit} className="space-y-4">
          <Field
            label="E-mail"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            placeholder="voce@exemplo.com"
          />

          {mode === 'register' && (
            <Field
              label="Nome de exibição"
              name="displayName"
              type="text"
              autoComplete="nickname"
              required
              minLength={2}
              maxLength={80}
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              placeholder="Como quer ser chamado"
            />
          )}

          <Field
            label="Senha"
            name="password"
            type="password"
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            required
            minLength={mode === 'register' ? 10 : undefined}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            {...(mode === 'register'
              ? { hint: 'Ao menos 10 caracteres, com letras e números.' }
              : {})}
          />

          <Button type="submit" variant="primary" size="lg" block loading={busy}>
            {mode === 'login' ? 'Entrar' : 'Criar conta'}
          </Button>
        </form>

        <div className="my-4 flex items-center gap-3">
          <span className="h-px flex-1 bg-night-800" />
          <span className="font-ui text-[11px] uppercase tracking-wider text-bronze-500">ou</span>
          <span className="h-px flex-1 bg-night-800" />
        </div>

        <Button variant="secondary" size="lg" block onClick={startGoogle}>
          Continuar com o Google
        </Button>

        <p className="mt-5 text-center font-ui text-sm text-parchment-400">
          {mode === 'login' ? 'Ainda não tem conta?' : 'Já tem conta?'}{' '}
          <button
            type="button"
            className="font-medium text-ember-300 underline-offset-2 hover:underline"
            onClick={() => {
              setMode(mode === 'login' ? 'register' : 'login');
              setError(null);
            }}
          >
            {mode === 'login' ? 'Criar uma' : 'Entrar'}
          </button>
        </p>
      </Panel>
    </div>
  );
}
