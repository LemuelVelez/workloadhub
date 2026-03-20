"use client"

import * as React from "react"

import { cn } from "@/lib/utils"

function Table({ className, ...props }: React.ComponentProps<"table">) {
  const containerRef = React.useRef<HTMLDivElement>(null)
  const [isDragging, setIsDragging] = React.useState(false)
  const [isScrollable, setIsScrollable] = React.useState(false)
  const dragStateRef = React.useRef({
    pointerId: -1,
    startX: 0,
    startScrollLeft: 0,
    moved: false,
  })

  React.useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const updateScrollableState = () => {
      setIsScrollable(container.scrollWidth > container.clientWidth)
    }

    updateScrollableState()

    const resizeObserver = new ResizeObserver(updateScrollableState)
    resizeObserver.observe(container)

    const table = container.querySelector("table")
    if (table) {
      resizeObserver.observe(table)
    }

    window.addEventListener("resize", updateScrollableState)

    return () => {
      resizeObserver.disconnect()
      window.removeEventListener("resize", updateScrollableState)
    }
  }, [])

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const container = containerRef.current
    if (!container || !isScrollable) return

    if (event.pointerType === "mouse" && event.button !== 0) return

    const target = event.target as HTMLElement | null
    if (
      target?.closest(
        'a, button, input, textarea, select, option, label, summary, [role="button"], [data-no-drag-scroll="true"]'
      )
    ) {
      return
    }

    dragStateRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startScrollLeft: container.scrollLeft,
      moved: false,
    }

    container.setPointerCapture(event.pointerId)
    setIsDragging(true)
  }

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const container = containerRef.current
    if (!container || !isDragging) return
    if (dragStateRef.current.pointerId !== event.pointerId) return

    const deltaX = event.clientX - dragStateRef.current.startX

    if (Math.abs(deltaX) > 4) {
      dragStateRef.current.moved = true
    }

    container.scrollLeft = dragStateRef.current.startScrollLeft - deltaX
  }

  const endDragging = (event: React.PointerEvent<HTMLDivElement>) => {
    const container = containerRef.current
    if (!container) return
    if (dragStateRef.current.pointerId !== event.pointerId) return

    if (container.hasPointerCapture(event.pointerId)) {
      container.releasePointerCapture(event.pointerId)
    }

    setIsDragging(false)
  }

  const handleClickCapture = (event: React.MouseEvent<HTMLDivElement>) => {
    if (dragStateRef.current.moved) {
      event.preventDefault()
      event.stopPropagation()
      dragStateRef.current.moved = false
    }
  }

  return (
    <div
      ref={containerRef}
      data-slot="table-container"
      className={cn(
        "relative w-full overflow-x-auto",
        isScrollable && "cursor-grab",
        isDragging && "cursor-grabbing select-none",
      )}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={endDragging}
      onPointerCancel={endDragging}
      onLostPointerCapture={() => setIsDragging(false)}
      onClickCapture={handleClickCapture}
    >
      <table
        data-slot="table"
        className={cn("w-full caption-bottom text-sm", className)}
        {...props}
      />
    </div>
  )
}

function TableHeader({ className, ...props }: React.ComponentProps<"thead">) {
  return (
    <thead
      data-slot="table-header"
      className={cn("[&_tr]:border-b", className)}
      {...props}
    />
  )
}

function TableBody({ className, ...props }: React.ComponentProps<"tbody">) {
  return (
    <tbody
      data-slot="table-body"
      className={cn("[&_tr:last-child]:border-0", className)}
      {...props}
    />
  )
}

function TableFooter({ className, ...props }: React.ComponentProps<"tfoot">) {
  return (
    <tfoot
      data-slot="table-footer"
      className={cn(
        "bg-muted/50 border-t font-medium [&>tr]:last:border-b-0",
        className
      )}
      {...props}
    />
  )
}

function TableRow({ className, ...props }: React.ComponentProps<"tr">) {
  return (
    <tr
      data-slot="table-row"
      className={cn(
        "hover:bg-muted/50 data-[state=selected]:bg-muted border-b transition-colors",
        className
      )}
      {...props}
    />
  )
}

function TableHead({ className, ...props }: React.ComponentProps<"th">) {
  return (
    <th
      data-slot="table-head"
      className={cn(
        "text-foreground h-10 px-2 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0 *:[[role=checkbox]]:translate-y-0.5",
        className
      )}
      {...props}
    />
  )
}

function TableCell({ className, ...props }: React.ComponentProps<"td">) {
  return (
    <td
      data-slot="table-cell"
      className={cn(
        "p-2 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0 *:[[role=checkbox]]:translate-y-0.5",
        className
      )}
      {...props}
    />
  )
}

function TableCaption({
  className,
  ...props
}: React.ComponentProps<"caption">) {
  return (
    <caption
      data-slot="table-caption"
      className={cn("text-muted-foreground mt-4 text-sm", className)}
      {...props}
    />
  )
}

export {
  Table,
  TableHeader,
  TableBody,
  TableFooter,
  TableHead,
  TableRow,
  TableCell,
  TableCaption,
}