import { Inbox } from "lucide-react";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: React.ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-16 h-16 rounded-full bg-[var(--color-accent-tint)] flex items-center justify-center mb-4">
        {icon || <Inbox size={28} className="text-[var(--color-accent)]" />}
      </div>
      <h3 className="text-base font-bold text-[var(--color-ink)] mb-1">{title}</h3>
      {description && <p className="text-sm text-[var(--color-ink-faint)] mb-4 max-w-sm">{description}</p>}
      {action}
    </div>
  );
}
