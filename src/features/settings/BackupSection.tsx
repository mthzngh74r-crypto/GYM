import { Card, Section } from '../../components/ui';

export function BackupSection() {
  return (
    <Section title="Резервная копия">
      <Card className="text-muted text-sm">Скоро: экспорт и импорт JSON, CSV.</Card>
    </Section>
  );
}
