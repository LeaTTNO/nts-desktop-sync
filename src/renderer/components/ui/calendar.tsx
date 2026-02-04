/**
 * ⚠️ IMPORTANT – DO NOT MODIFY LAYOUT ⚠️
 *
 * This Calendar component is intentionally locked.
 * The current structure fixes multiple layout issues caused by:
 * - shadcn Calendar wrapper
 * - duplicate DayPicker captions
 * - Radix Popover width inheritance
 * - global Tailwind / table styles
 *
 * DO NOT:
 * - change DayPicker structure (caption, nav, months)
 * - add Tailwind layout classes (flex/grid) around DayPicker
 * - reintroduce shadcn Calendar wrapper
 * - add CSS using global selectors (table, th, td)
 *
 * ONLY allowed changes:
 * - colors
 * - spacing inside day cells
 * - icons (Chevron)
 *
 * If layout breaks again, check for duplicate captions or wrapper components.
 */
import * as React from "react";
import { DayPicker } from "react-day-picker";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

import "react-day-picker/dist/style.css";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, locale, ...props }: CalendarProps) {
  // Use defaultMonth, selected date, or current date as initial month
  const getInitialMonth = () => {
    if (props.defaultMonth) return props.defaultMonth;
    // Type-safe access to selected
    const selected = 'selected' in props ? props.selected : undefined;
    if (selected && selected instanceof Date) return selected;
    if (props.month) return props.month;
    return new Date();
  };
  
  const [internalMonth, setInternalMonth] = React.useState(getInitialMonth());
  const displayMonth = props.month || internalMonth;

  const handlePreviousMonth = () => {
    const newMonth = new Date(displayMonth);
    newMonth.setMonth(newMonth.getMonth() - 1);
    setInternalMonth(newMonth);
    props.onMonthChange?.(newMonth);
  };

  const handleNextMonth = () => {
    const newMonth = new Date(displayMonth);
    newMonth.setMonth(newMonth.getMonth() + 1);
    setInternalMonth(newMonth);
    props.onMonthChange?.(newMonth);
  };

  // Format month/year using locale if provided
  const formatMonthYear = () => {
    // Check if locale has the date-fns structure
    if (locale && typeof locale === 'object' && 'localize' in locale && locale.localize) {
      const monthIndex = displayMonth.getMonth();
      const year = displayMonth.getFullYear();
      const monthName = (locale.localize as any).month(monthIndex, { width: 'wide' });
      return `${monthName} ${year}`;
    }
    return displayMonth.toLocaleDateString("nb-NO", {
      month: "long",
      year: "numeric",
    });
  };

  return (
    <div className="p-2">
      <div className="flex items-center justify-between px-1 pb-1">
        <button
          onClick={handlePreviousMonth}
          className="h-6 w-6 bg-transparent p-0 opacity-50 hover:opacity-100"
          type="button"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>

        <span className="text-xs font-medium">
          {formatMonthYear()}
        </span>

        <button
          onClick={handleNextMonth}
          className="h-6 w-6 bg-transparent p-0 opacity-50 hover:opacity-100"
          type="button"
          aria-label="Next month"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <DayPicker
        className={className}
        locale={locale}
        month={displayMonth}
        onMonthChange={(newMonth) => {
          setInternalMonth(newMonth);
          props.onMonthChange?.(newMonth);
        }}
        showOutsideDays
        fixedWeeks
        hideNavigation
        {...props}
      />
    </div>
  );
}

Calendar.displayName = "Calendar";

export { Calendar };
