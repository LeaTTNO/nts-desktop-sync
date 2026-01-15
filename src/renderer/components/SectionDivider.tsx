import React from "react";

interface SectionDividerProps {
  icon?: React.ReactNode;
  title?: string;
}

export default function SectionDivider({ icon, title }: SectionDividerProps) {
  return (
    <div className="flex items-center gap-4 my-2">
      <div className="flex-1 h-px bg-border" />
      {(icon || title) && (
        <div className="flex items-center gap-2 px-2 whitespace-nowrap">
          {icon && <span>{icon}</span>}
          {title && <span className="text-sm font-semibold uppercase tracking-wider text-foreground">{title}</span>}
        </div>
      )}
      <div className="flex-1 h-px bg-border" />
    </div>
  );
}
