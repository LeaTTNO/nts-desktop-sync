import * as React from "react";
import { DayPicker } from "react-day-picker";

import { cn } from "@/lib/utils";
import { buttonVariants } from "@/components/ui/button";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3", className)}
      classNames={{
        /* MONTH LAYOUT */
        months: "flex flex-col sm:flex-row gap-4",
        month: "space-y-4",

        /* HEADER */
        caption: "flex justify-center pt-1 relative items-center",
        caption_label: "text-sm font-medium",

        nav: "flex items-center gap-1",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "h-7 w-7 bg-transparent p-0 opacity-50 hover:opacity-100"
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",

        /* 🔑 VIKTIG: EKTE TABELL = KORREKT KALENDER */
        table: "w-full border-collapse",
        head_row: "",
        head_cell:
          "text-muted-foreground rounded-md w-9 font-normal text-[0.8rem] text-center",

        row: "",
        cell:
          "h-9 w-9 text-center text-sm p-0 relative " +
          "[&:has([aria-selected])]:bg-accent " +
          "focus-within:relative focus-within:z-20",

        day: cn(
          buttonVariants({ variant: "ghost" }),
          "h-9 w-9 p-0 font-normal aria-selected:opacity-100"
        ),

        day_selected:
          "bg-primary text-primary-foreground hover:bg-primary hover:text-primary-foreground",
        day_today: "bg-accent text-accent-foreground",
        day_outside:
          "text-muted-foreground opacity-50 aria-selected:bg-accent/50",
        day_disabled: "text-muted-foreground opacity-50",
        day_hidden: "invisible",

        ...classNames,
      }}
      {...props}
    />
  );
}

Calendar.displayName = "Calendar";
export { Calendar };
