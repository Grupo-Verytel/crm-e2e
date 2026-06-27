import type { FormEvent } from 'react';
import { useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BrandMark } from '../../../layout/BrandMark';
import { getLoginErrorMessage } from '../lib/login-errors';
import { useAuth } from '../hooks/useAuth';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const redirectTo =
    (location.state as { from?: string } | null)?.from ?? '/opportunities';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    try {
      await login({ email: email.trim(), password });
      navigate(redirectTo, { replace: true });
    } catch (submitError) {
      setError(getLoginErrorMessage(submitError));
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4">
      <div className="w-full max-w-md rounded bg-surface p-8 shadow-card">
        <div className="mb-8 flex justify-center">
          <BrandMark className="h-7 w-auto" />
        </div>

        <h1 className="mb-1 text-center text-lg font-bold text-ink">Iniciar sesión</h1>
        <p className="mb-6 text-center text-sm text-muted">
          Accede al CRM con tu cuenta de Verytel.
        </p>

        <form className="space-y-4" onSubmit={handleSubmit}>
          <div>
            <label htmlFor="email" className="mb-1 block text-sm font-bold text-ink">
              Correo
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="h-10 w-full rounded border border-border bg-bg px-3 text-sm text-ink outline-none focus:border-brand focus:bg-surface"
              placeholder="nombre@verytel.com"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1 block text-sm font-bold text-ink">
              Contraseña
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              minLength={8}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="h-10 w-full rounded border border-border bg-bg px-3 text-sm text-ink outline-none focus:border-brand focus:bg-surface"
            />
          </div>

          {error ? (
            <p className="rounded-sm bg-bg px-3 py-2 text-sm text-danger" role="alert">
              {error}
            </p>
          ) : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="h-10 w-full rounded bg-brand text-sm font-bold text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? 'Ingresando…' : 'Ingresar'}
          </button>
        </form>
      </div>
    </div>
  );
}
