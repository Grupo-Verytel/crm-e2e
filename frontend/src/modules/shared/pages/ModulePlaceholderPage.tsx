import { AppLayout } from '../../../layout/AppLayout';

type ModulePlaceholderPageProps = {
  title: string;
  description: string;
};

export function ModulePlaceholderPage({ title, description }: ModulePlaceholderPageProps) {
  return (
    <AppLayout title={title}>
      <div className="rounded bg-surface p-8 shadow-card">
        <p className="text-sm text-muted">{description}</p>
      </div>
    </AppLayout>
  );
}
