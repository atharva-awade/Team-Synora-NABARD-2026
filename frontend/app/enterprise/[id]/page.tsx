import { AppShell } from "@/components/app/app-shell";
import { EnterpriseDetailView } from "@/components/enterprise/detail";

export default async function EnterprisePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return (
    <AppShell>
      <EnterpriseDetailView id={id} />
    </AppShell>
  );
}
