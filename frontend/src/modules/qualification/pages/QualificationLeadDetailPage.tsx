import { LeadDetailPage } from '../../demand-generation/pages/LeadDetailPage';
import { QualificationNav } from '../components/QualificationNav';

export function QualificationLeadDetailPage() {
  return (
    <LeadDetailPage
      moduleNav={<QualificationNav />}
      backTo="/qualification/dashboard"
      backLabel="← Volver al dashboard"
      afterDiscardPath="/qualification/dashboard"
    />
  );
}

export default QualificationLeadDetailPage;
