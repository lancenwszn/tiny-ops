"use client";

import { useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Widget, SoonBadge } from "./widget";
import { buildMonthGrid, shiftMonth } from "../calendar";
import { cn } from "@/lib/utils";

export type CalendarEventKind = "task" | "checklist" | "deadline";

/** Scheduled items supplied by Tasks/Checklists in later stages. */
export type CalendarEvent = { id: string; date: string; kind: CalendarEventKind; title: string };

const KIND_DOT: Record<CalendarEventKind, string> = {
  task: "bg-chart-1",
  checklist: "bg-chart-2",
  deadline: "bg-chart-4",
};
const KIND_LABEL: Record<CalendarEventKind, string> = { task: "Tasks", checklist: "Checklists", deadline: "Deadlines" };
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH = new Intl.DateTimeFormat("en-US", { month: "long", year: "numeric", timeZone: "UTC" });
const LONG = new Intl.DateTimeFormat("en-US", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });

export function OperationsCalendar({
  today,
  events,
  scheduling,
}: {
  /** Today's date (YYYY-MM-DD) in the workspace timezone. */
  today: string;
  events: CalendarEvent[];
  /** Whether any scheduling module (tasks/checklists) is live yet. */
  scheduling: boolean;
}) {
  const [ty, tm] = today.split("-").map(Number);
  const [view, setView] = useState({ year: ty, month: tm - 1 });
  const [selected, setSelected] = useState(today);

  const cells = buildMonthGrid(view.year, view.month);
  const byDate = new Map<string, CalendarEvent[]>();
  for (const e of events) byDate.set(e.date, [...(byDate.get(e.date) ?? []), e]);
  const selectedEvents = byDate.get(selected) ?? [];
  const title = MONTH.format(Date.UTC(view.year, view.month, 1));
  const isCurrentMonth = view.year === ty && view.month === tm - 1;

  return (
    <Widget
      title="Operations Calendar"
      icon={CalendarDays}
      tint="green"
      id="ops-calendar"
      action={
        !isCurrentMonth ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-[13px] text-muted-foreground"
            onClick={() => {
              setView({ year: ty, month: tm - 1 });
              setSelected(today);
            }}
          >
            Today
          </Button>
        ) : !scheduling ? (
          <SoonBadge />
        ) : undefined
      }
    >
      <div className="flex items-center justify-between">
        <p className="font-bold" aria-live="polite" data-testid="calendar-month">
          {title}
        </p>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon-sm" aria-label="Previous month" onClick={() => setView((v) => shiftMonth(v.year, v.month, -1))}>
            <ChevronLeft />
          </Button>
          <Button variant="ghost" size="icon-sm" aria-label="Next month" onClick={() => setView((v) => shiftMonth(v.year, v.month, 1))}>
            <ChevronRight />
          </Button>
        </div>
      </div>

      <div role="grid" aria-label={title} className="mt-2 grid grid-cols-7 gap-y-0.5 text-center">
        {WEEKDAYS.map((d) => (
          <div key={d} role="columnheader" className="pb-1 text-xs font-semibold text-muted-foreground">
            {d}
          </div>
        ))}
        {cells.map((cell) => {
          const dayEvents = byDate.get(cell.date) ?? [];
          const isToday = cell.date === today;
          const isSelected = cell.date === selected;
          return (
            <div key={cell.date} role="gridcell" className="flex justify-center">
              <button
                type="button"
                onClick={() => setSelected(cell.date)}
                aria-label={`${LONG.format(new Date(`${cell.date}T00:00:00Z`))}${isToday ? ", today" : ""}${dayEvents.length ? `, ${dayEvents.length} scheduled` : ""}`}
                aria-pressed={isSelected}
                aria-current={isToday ? "date" : undefined}
                className={cn(
                  "relative flex size-8 cursor-pointer flex-col items-center justify-center rounded-full text-[13px] font-medium transition-colors",
                  !cell.inMonth && "text-muted-foreground/45",
                  isToday ? "bg-primary font-bold text-primary-foreground shadow-sm" : isSelected ? "bg-secondary text-secondary-foreground" : "hover:bg-muted",
                )}
              >
                {cell.day}
                {dayEvents.length > 0 && (
                  <span className="absolute bottom-0.5 flex gap-0.5">
                    {[...new Set(dayEvents.map((e) => e.kind))].slice(0, 3).map((k) => (
                      <span key={k} className={cn("size-1 rounded-full", isToday ? "bg-white" : KIND_DOT[k])} />
                    ))}
                  </span>
                )}
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-3 rounded-xl bg-muted/60 px-3 py-2.5">
        <p className="text-xs font-semibold text-muted-foreground">{LONG.format(new Date(`${selected}T00:00:00Z`))}</p>
        {selectedEvents.length > 0 ? (
          <ul className="mt-1.5 grid gap-1">
            {selectedEvents.map((e) => (
              <li key={e.id} className="flex items-center gap-2 text-sm">
                <span className={cn("size-2 rounded-full", KIND_DOT[e.kind])} aria-hidden />
                <span className="truncate">{e.title}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-1 text-sm text-muted-foreground">
            {scheduling ? "Nothing scheduled." : "Tasks and recurring checklists will be scheduled here."}
          </p>
        )}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {(Object.keys(KIND_LABEL) as CalendarEventKind[]).map((k) => (
          <span key={k} className="inline-flex items-center gap-1.5">
            <span className={cn("size-2 rounded-full", KIND_DOT[k])} aria-hidden /> {KIND_LABEL[k]}
          </span>
        ))}
      </div>
    </Widget>
  );
}
