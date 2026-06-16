"use client";

import * as React from "react";
import { format, type Locale } from "date-fns";
import { Calendar } from "@/components/ui/calendar";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

export interface CalendarSchedulerTexts {
  availableTimes?: string;
  noSlots?: string;
  reset?: string;
  confirm?: string;
  selectDate?: string;
  dateFormat?: string;
}

export interface CalendarSchedulerProps {
  /** Fallback static slots — used only when availableSlots is undefined */
  timeSlots?: string[];
  /** Real slots fetched from the API; undefined = not yet fetched */
  availableSlots?: string[];
  loadingSlots?: boolean;
  confirmLoading?: boolean;
  onDateChange?: (date: Date | undefined) => void;
  onConfirm?: (value: { date?: Date; time?: string }) => void;
  texts?: CalendarSchedulerTexts;
  dateLocale?: Locale;
}

function CalendarScheduler({
  timeSlots = [],
  availableSlots,
  loadingSlots = false,
  confirmLoading = false,
  onDateChange,
  onConfirm,
  texts,
  dateLocale,
}: CalendarSchedulerProps) {
  const [date, setDate] = React.useState<Date | undefined>(undefined);
  const [time, setTime] = React.useState<string | undefined>();

  const {
    availableTimes = "Available times",
    noSlots = "No available slots",
    reset = "Reset",
    confirm = "Confirm",
    selectDate = "Select a date",
    dateFormat: fmt = "EEEE, MMMM d, yyyy",
  } = texts ?? {};

  const titleText = date
    ? format(date, fmt, dateLocale ? { locale: dateLocale } : undefined)
    : selectDate;

  const slots = availableSlots ?? timeSlots;

  function handleDateSelect(d: Date | undefined) {
    setDate(d);
    setTime(undefined);
    onDateChange?.(d);
  }

  return (
    <div className="w-full">
      <Card className="w-full shadow-none border border-border bg-background">
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-medium text-foreground capitalize">
            {titleText}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col sm:flex-row gap-4">
          {/* Calendar */}
          <div className="flex-1 border border-border rounded-lg p-3">
            <Calendar
              mode="single"
              selected={date}
              onSelect={handleDateSelect}
              className="rounded-md"
              disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
            />
          </div>

          {/* Time slots */}
          <div className="flex-1 border border-border rounded-lg p-3 overflow-y-auto max-h-[340px]">
            <p className="mb-3 text-sm font-medium text-muted-foreground">
              {availableTimes}
            </p>

            {!date ? (
              <p className="text-xs text-muted-foreground">{selectDate}</p>
            ) : loadingSlots ? (
              <div className="grid grid-cols-2 gap-2">
                {Array.from({ length: 8 }).map((_, i) => (
                  <div
                    key={i}
                    className="h-8 rounded-md bg-muted animate-pulse"
                  />
                ))}
              </div>
            ) : slots.length === 0 ? (
              <p className="text-xs text-muted-foreground">{noSlots}</p>
            ) : (
              <div className="grid grid-cols-2 gap-2">
                {slots.map((slot) => (
                  <Button
                    key={slot}
                    variant={time === slot ? "default" : "outline"}
                    size="sm"
                    className={cn(
                      "w-full text-xs",
                      time === slot && "ring-2 ring-primary ring-offset-1",
                    )}
                    onClick={() => setTime(slot)}
                  >
                    {slot}
                  </Button>
                ))}
              </div>
            )}
          </div>
        </CardContent>
        <CardFooter className="flex justify-between pt-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              setDate(undefined);
              setTime(undefined);
              onDateChange?.(undefined);
            }}
          >
            {reset}
          </Button>
          <Button
            size="sm"
            onClick={() => onConfirm?.({ date, time })}
            disabled={!date || !time || confirmLoading}
          >
            {confirmLoading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              confirm
            )}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}

export { CalendarScheduler };
