import { Eye, EyeOff, ShieldCheck } from 'lucide-react';
import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import apoloLogoDark from '../../../assets/apolo-logo-dark.webp';
import apoloOrbita from '../../../assets/apolo-orbita.webp';
import { getLoginErrorMessage } from '../lib/login-errors';
import { useAuth } from '../hooks/useAuth';

type LoginSlide = {
  title: string;
  description?: string;
  highlight?: string;
};

const LOGIN_SLIDES: readonly LoginSlide[] = [
  {
    title: 'Una misión compartida.',
    highlight: 'Todo el recorrido conectado.',
  },
  {
    title: 'Relaciones que crecen',
    description:
      'Centraliza cada conversación y construye confianza durante todo el ciclo comercial.',
  },
  {
    title: 'Oportunidades con propósito',
    description:
      'Alinea a tu equipo, prioriza mejor y mantén visible el siguiente paso de cada negocio.',
  },
  {
    title: 'Información que da confianza',
    description:
      'Consulta el historial de cada cliente y toma decisiones con datos claros y seguros.',
  },
];

const PHASES = ['PROSPECTA', 'CALIFICA', 'GESTIONA', 'CONSOLIDA'] as const;

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
  const [showPassword, setShowPassword] = useState(false);
  const [activeSlide, setActiveSlide] = useState(0);

  useEffect(() => {
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    if (reducedMotion.matches) {
      return undefined;
    }

    const interval = window.setInterval(() => {
      setActiveSlide((current) => (current + 1) % LOGIN_SLIDES.length);
    }, 6000);

    return () => window.clearInterval(interval);
  }, []);

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

  const slide = LOGIN_SLIDES[activeSlide];

  return (
    <main className="min-h-screen overflow-x-hidden bg-login-right [color-scheme:dark] lg:grid lg:grid-cols-[minmax(0,1.08fr)_minmax(28rem,0.92fr)]">
      <section
        className="relative hidden min-h-screen flex-col bg-login-left px-12 py-10 text-white lg:flex xl:px-20 xl:py-14"
        aria-label="Beneficios de APOLO"
      >
        <img
          src={apoloLogoDark}
          alt="APOLO por Frisson"
          className="h-auto w-full max-w-md"
          draggable={false}
        />

        <div className="my-auto">
          <img
            src={apoloOrbita}
            alt=""
            aria-hidden="true"
            className="mx-auto mb-10 h-auto w-full max-w-xl"
            draggable={false}
          />

          <div className="mx-auto max-w-xl" aria-live="polite">
            {slide.highlight ? (
              <h2 className="text-3xl font-bold leading-tight xl:text-4xl">
                <span className="block">{slide.title}</span>
                <span className="mt-2 block text-login-accent">{slide.highlight}</span>
              </h2>
            ) : (
              <>
                <p className="mb-3 text-sm text-white/80">Creamos relaciones a largo plazo</p>
                <h2 className="mb-4 text-3xl font-bold leading-tight xl:text-4xl">
                  {slide.title}
                </h2>
                <p className="max-w-lg text-base leading-7 text-white/90">
                  {slide.description}
                </p>
              </>
            )}
          </div>

          <div className="mx-auto mt-8 flex w-full max-w-xl items-center gap-2">
            {LOGIN_SLIDES.map((item, index) => (
              <button
                key={item.title}
                type="button"
                onClick={() => setActiveSlide(index)}
                className={`h-2 rounded-full transition-[width,background-color] ${
                  activeSlide === index
                    ? 'w-8 bg-login-accent'
                    : 'w-2 bg-white/40 hover:bg-white/70'
                }`}
                aria-label={`Ver mensaje ${index + 1}: ${item.title}`}
                aria-current={activeSlide === index ? 'true' : undefined}
              />
            ))}
          </div>
        </div>

        <p className="text-center text-xs tracking-widest text-white/50">
          {PHASES.map((phase, index) => (
            <span key={phase}>
              {index > 0 ? (
                <span className="text-login-accent"> • </span>
              ) : null}
              {phase}
            </span>
          ))}
        </p>
      </section>

      <section className="flex min-h-screen items-center justify-center bg-login-right px-5 py-10 sm:px-10 lg:px-16">
        <div className="w-full max-w-md">
          <img
            src={apoloLogoDark}
            alt="APOLO por Frisson"
            className="mb-8 h-auto w-full max-w-xs lg:hidden"
            draggable={false}
          />

          <div className="mb-8">
            <p className="mb-2 text-sm text-login-accent">Bienvenido a bordo</p>
            <h1 className="mb-3 text-3xl font-bold tracking-tight text-white">
              Inicia sesión
            </h1>
            <p className="text-sm leading-6 text-white/70">
              Tu próxima gran oportunidad comienza aquí.
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <div>
              <label htmlFor="email" className="mb-2 block text-sm text-white">
                Correo corporativo
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                required
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="login-input h-12 w-full rounded border border-white/15 bg-login-left px-4 text-sm text-white outline-none transition-colors placeholder:text-white/40 focus:border-login-accent focus:ring-2 focus:ring-login-accent/20"
                placeholder="nombre@grupoverytel.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-2 block text-sm text-white">
                Contraseña
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  className="login-input h-12 w-full rounded border border-white/15 bg-login-left px-4 pr-12 text-sm text-white outline-none transition-colors focus:border-login-accent focus:ring-2 focus:ring-login-accent/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="btn-glow-outline login-toggle absolute inset-y-0 right-0 m-1 grid w-10 place-items-center rounded text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-login-accent"
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff size={19} /> : <Eye size={19} />}
                </button>
              </div>
            </div>

            {error ? (
              <p
                className="rounded-sm border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-danger"
                role="alert"
              >
                {error}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={isSubmitting}
              className="btn-glow login-submit flex h-12 w-full items-center justify-center gap-2 rounded text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-login-accent focus-visible:ring-offset-2 focus-visible:ring-offset-login-right disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Ingresando…' : 'Ingresar a APOLO'}
            </button>
          </form>

          <div className="mt-10 flex items-center gap-2 border-t border-white/10 pt-6 text-xs text-white/60">
            <ShieldCheck size={16} className="text-login-accent" aria-hidden="true" />
            <span>Acceso seguro para colaboradores autorizados.</span>
          </div>
        </div>
      </section>
    </main>
  );
}
