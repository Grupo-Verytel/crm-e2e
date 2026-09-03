import { Eye, EyeOff, Handshake, ShieldCheck, Target, Users } from 'lucide-react';
import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { BrandMark } from '../../../layout/BrandMark';
import { getLoginErrorMessage } from '../lib/login-errors';
import { useAuth } from '../hooks/useAuth';

const LOGIN_SLIDES = [
  {
    title: 'Relaciones que crecen',
    description:
      'Centraliza cada conversación y construye confianza durante todo el ciclo comercial.',
    icon: Handshake,
    detailIcon: Users,
  },
  {
    title: 'Oportunidades con propósito',
    description:
      'Alinea a tu equipo, prioriza mejor y mantén visible el siguiente paso de cada negocio.',
    icon: Target,
    detailIcon: Users,
  },
  {
    title: 'Información que da confianza',
    description:
      'Consulta el historial de cada cliente y toma decisiones con datos claros y seguros.',
    icon: ShieldCheck,
    detailIcon: Handshake,
  },
] as const;

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
  const SlideIcon = slide.icon;
  const DetailIcon = slide.detailIcon;

  return (
    <main className="min-h-screen bg-login-right [color-scheme:dark] lg:grid lg:grid-cols-[minmax(0,1.08fr)_minmax(28rem,0.92fr)]">
      {/* Panel izquierdo — branding gris */}
      <section
        className="relative hidden min-h-screen overflow-hidden bg-login-left px-12 py-10 text-white lg:flex lg:flex-col xl:px-20 xl:py-14"
        aria-label="Beneficios de Frisson CRM"
      >
        <div className="absolute -left-16 top-1/4 h-48 w-48 rounded-full border border-white/15" />
        <div className="absolute -right-20 bottom-20 h-72 w-72 rounded-full border border-white/15" />
        <div className="absolute right-16 top-16 h-3 w-3 rounded-full bg-white/80" />

        <div className="relative z-10">
          <BrandMark
            className="h-[3.4rem] w-auto gap-4"
            wordmarkClassName="text-[22px] text-white"
            variant="dark"
          />
        </div>

        <div className="relative z-10 my-auto">
          <div
            className="mx-auto mb-12 flex h-72 max-w-xl items-center justify-center"
            aria-hidden="true"
          >
            <div className="relative grid h-52 w-80 place-items-center rounded border border-white/25 bg-white/10 shadow-card">
              <div className="absolute -left-8 top-8 grid h-16 w-16 place-items-center rounded bg-login-right text-accent shadow-card">
                <DetailIcon size={28} strokeWidth={1.7} />
              </div>
              <div className="absolute -right-7 bottom-7 grid h-14 w-14 place-items-center rounded-full bg-white text-accent shadow-card">
                <ShieldCheck size={25} strokeWidth={1.8} />
              </div>
              <div className="grid h-28 w-28 place-items-center rounded-full border border-white/25 bg-white/10">
                <SlideIcon size={64} strokeWidth={1.25} />
              </div>
              <span className="absolute left-12 top-9 h-2 w-14 rounded-full bg-white/25" />
              <span className="absolute bottom-11 right-14 h-2 w-20 rounded-full bg-white/25" />
            </div>
          </div>

          <div className="mx-auto max-w-xl" aria-live="polite">
            <p className="mb-3 text-sm text-white/80">Creamos relaciones a largo plazo</p>
            <h2 className="mb-4 text-3xl font-bold leading-tight xl:text-4xl">
              {slide.title}
            </h2>
            <p className="max-w-lg text-base leading-7 text-white/90">
              {slide.description}
            </p>
          </div>
        </div>

        <div className="relative z-10 mx-auto flex w-full max-w-xl items-center gap-2">
          {LOGIN_SLIDES.map((item, index) => (
            <button
              key={item.title}
              type="button"
              onClick={() => setActiveSlide(index)}
              className={`h-2 rounded-full transition-[width,background-color] ${
                activeSlide === index ? 'w-8 bg-white' : 'w-2 bg-white/40 hover:bg-white/70'
              }`}
              aria-label={`Ver mensaje ${index + 1}: ${item.title}`}
              aria-current={activeSlide === index ? 'true' : undefined}
            />
          ))}
        </div>
      </section>

      {/* Panel derecho — formulario casi negro */}
      <section className="flex min-h-screen items-center justify-center bg-login-right px-5 py-10 sm:px-10 lg:px-16">
        <div className="w-full max-w-md">
          <div className="mb-8">
            <p className="mb-2 text-sm text-accent">Bienvenido de nuevo</p>
            <h1 className="mb-3 text-3xl font-bold tracking-tight text-white">
              Inicia sesión
            </h1>
            <p className="text-sm leading-6 text-white/70">
              Accede a tu espacio de trabajo y continúa gestionando tus relaciones comerciales.
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
                className="login-input h-12 w-full rounded border border-white/15 bg-login-left px-4 text-sm text-white outline-none transition-colors placeholder:text-white/40 focus:border-accent focus:ring-2 focus:ring-accent/20"
                placeholder="nombre@verytel.com"
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
                  className="login-input h-12 w-full rounded border border-white/15 bg-login-left px-4 pr-12 text-sm text-white outline-none transition-colors focus:border-accent focus:ring-2 focus:ring-accent/20"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="btn-glow-outline absolute inset-y-0 right-0 m-1 grid w-10 place-items-center rounded text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
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
              className="btn-glow flex h-12 w-full items-center justify-center gap-2 rounded text-sm text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-login-right disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isSubmitting ? 'Ingresando…' : 'Ingresar al CRM'}
            </button>
          </form>

          <div className="mt-10 flex items-center gap-2 border-t border-white/10 pt-6 text-xs text-white/60">
            <ShieldCheck size={16} className="text-accent" aria-hidden="true" />
            <span>Acceso seguro para colaboradores autorizados.</span>
          </div>
        </div>
      </section>
    </main>
  );
}
