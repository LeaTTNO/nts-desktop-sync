import * as React from "react";
import { DayPicker } from "react-day-picker";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

import "react-day-picker/dist/style.css";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({ className, locale, ...props }: CalendarProps) {
  const [internalMonth, setInternalMonth] = React.useState(props.month || new Date());
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
    <div className="p-3">
      <div className="flex items-center justify-between px-2 pb-2">
        <button
          onClick={handlePreviousMonth}
          className="h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
          type="button"
          aria-label="Previous month"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>

        <span className="text-sm font-medium">
          {formatMonthYear()}
        </span>

        <button
          onClick={handleNextMonth}
          className="h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
          type="button"
          aria-label="Next month"
        >
          <ChevronRight className="h-4 w-4" />
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
        hideNavigation
        {...props}
      />
    </div>
  );
}

Calendar.displayName = "Calendar";

export { Calendar };
