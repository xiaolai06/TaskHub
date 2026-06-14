"use client"

import * as React from "react"
import { DayPicker } from "react-day-picker"
import { zhCN } from "react-day-picker/locale"
import { UI, DayFlag, SelectionState } from "react-day-picker"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { Solar } from "lunar-javascript"

import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"

/** 获取农历日文字（如 "初一"、"十五"），初一显示月份 */
function getLunarDayText(year: number, month: number, day: number): string {
  try {
    const solar = Solar.fromYmd(year, month, day)
    const lunar = solar.getLunar()
    const lunarDay = lunar.getDayInChinese()
    if (lunarDay === '初一') {
      return lunar.getMonthInChinese() + '月'
    }
    return lunarDay
  } catch {
    return ''
  }
}

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      locale={zhCN}
      showOutsideDays={showOutsideDays}
      className={cn("p-4", className)}
      classNames={{
        [UI.Months]: "flex gap-4",
        [UI.Month]: "space-y-4",
        [UI.MonthCaption]: "flex justify-center items-center h-8 relative",
        [UI.CaptionLabel]: "text-sm font-semibold text-foreground",
        [UI.Nav]: "absolute inset-x-0 flex justify-between items-center",
        [UI.PreviousMonthButton]: cn(
          buttonVariants({ variant: "ghost", size: "icon-sm" }),
          "text-muted-foreground hover:text-foreground hover:bg-indigo-50",
        ),
        [UI.NextMonthButton]: cn(
          buttonVariants({ variant: "ghost", size: "icon-sm" }),
          "text-muted-foreground hover:text-foreground hover:bg-indigo-50",
        ),
        [UI.Dropdowns]: "flex items-center gap-1.5",
        [UI.Dropdown]: cn(
          "h-7 rounded-lg border border-border bg-transparent px-2 text-xs font-medium",
          "focus:border-indigo-400 focus:ring-2 focus:ring-indigo-200/60 focus:outline-none",
        ),
        [UI.DropdownRoot]: "relative",
        [UI.Weekdays]: "flex mb-1",
        [UI.Weekday]: cn(
          "w-11 rounded-md text-[11px] font-medium text-muted-foreground/70",
          "flex items-center justify-center py-1.5",
        ),
        [UI.Week]: "flex",
        [UI.WeekNumber]: "w-7 text-xs text-muted-foreground flex items-center justify-center",
        [UI.WeekNumberHeader]: "w-7 text-xs text-muted-foreground flex items-center justify-center",
        [UI.Day]: cn(
          "relative w-11 py-0.5",
          "transition-colors",
        ),
        [DayFlag.today]: "[&_button]:font-semibold [&_button]:text-indigo-600 [&_button]:bg-indigo-50/70",
        [DayFlag.outside]: "[&_button]:text-muted-foreground/30 [&_.lunar-text]:text-muted-foreground/20",
        [DayFlag.disabled]: "[&_button]:text-muted-foreground/30 [&_button]:cursor-not-allowed [&_button]:hover:bg-transparent",
        [SelectionState.selected]: cn(
          "[&_button]:!bg-indigo-600 [&_button]:!text-white [&_button]:hover:!bg-indigo-700",
          "[&_button]:shadow-md [&_button]:shadow-indigo-200/60",
          "[&_.lunar-text]:!text-indigo-200/80",
        ),
        [UI.Root]: "w-fit",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) => {
          const Icon = orientation === "left" ? ChevronLeftIcon : ChevronRightIcon
          return <Icon className="size-4" />
        },
        DayButton: ({ day, modifiers, ...btnProps }) => {
          const d = day.date
          const lunarText = getLunarDayText(
            d.getFullYear(),
            d.getMonth() + 1,
            d.getDate(),
          )

          return (
            <button
              type="button"
              {...btnProps}
              className={cn(
                "inline-flex h-9 w-9 flex-col items-center justify-center rounded-lg",
                "transition-all duration-150 cursor-pointer select-none gap-0",
                "hover:bg-indigo-50 hover:text-indigo-700",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-300",
                btnProps.className,
              )}
            >
              <span className="text-[13px] leading-tight">{d.getDate()}</span>
              {lunarText && (
                <span className="lunar-text text-[8px] leading-none text-muted-foreground/50">
                  {lunarText}
                </span>
              )}
            </button>
          )
        },
      }}
      {...props}
    />
  )
}

export { Calendar }
