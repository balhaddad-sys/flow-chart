import Link from "next/link";
import { Button } from "@/components/ui/button";

interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: { label: string; href?: string; onClick?: () => void };
}

export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center animate-in-up">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted/80 mb-4">
        <Icon className="h-6 w-6 text-muted-foreground/60" />
      </div>
      <p className="text-base font-semibold">{title}</p>
      <p className="mt-1.5 text-sm text-muted-foreground max-w-sm leading-relaxed">{description}</p>
      {action && (
        action.href ? (
          <Link href={action.href}>
            <Button variant="outline" size="sm" className="mt-4">
              {action.label}
            </Button>
          </Link>
        ) : action.onClick ? (
          <Button variant="outline" size="sm" className="mt-4" onClick={action.onClick}>
            {action.label}
          </Button>
        ) : null
      )}
    </div>
  );
}
