import { Loader } from './Loader';

export function LoadingScreen() {
  return (
    <div className="flex h-screen items-center justify-center bg-bg">
      <Loader />
    </div>
  );
}
