import * as React from "react"

import { cn } from "@/lib/utils"

type TableProps = React.ComponentProps<"table"> & {
  /**
   * Optional className for the outer table container.
   * Useful when you need to control overflow/width behavior (e.g., inside ScrollArea).
   */
  containerClassName?: string
  /**
   * Enables pointer-based horizontal drag scrolling on the table container.
   */
  dragScroll?: boolean
}

function Table({
  className,
  containerClassName,
  dragScroll = false,
  ...props
}: TableProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null)
  const dragStateRef = React.useRef({
    isPointerDown: false,
    didDrag: false,
    startX: 0,
    scrollLeft: 0,
    pointerId: -1,
  })
  const [isDragging, setIsDragging] = React.useState(false)

  const stopDragging = React.useCallback(() => {
    const container = containerRef.current
    const { pointerId } = dragStateRef.current

    if (container && pointerId >= 0 && container.hasPointerCapture(pointerId)) {
      container.releasePointerCapture(pointerId)
    }

    dragStateRef.current.isPointerDown = false
    dragStateRef.current.startX = 0
    dragStateRef.current.scrollLeft = 0
    dragStateRef.current.pointerId = -1
    setIsDragging(false)
  }, [])

  const handlePointerDown = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!dragScroll || event.pointerType === "touch" || event.button !== 0) return

      const container = containerRef.current
      if (!container || container.scrollWidth <= container.clientWidth) return

      dragStateRef.current.isPointerDown = true
      dragStateRef.current.didDrag = false
      dragStateRef.current.startX = event.clientX
      dragStateRef.current.scrollLeft = container.scrollLeft
      dragStateRef.current.pointerId = event.pointerId

      container.setPointerCapture(event.pointerId)
    },
    [dragScroll]
  )

  const handlePointerMove = React.useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!dragScroll || !dragStateRef.current.isPointerDown) return

      const container = containerRef.current
      if (!container) return

      const deltaX = event.clientX - dragStateRef.current.startX

      if (Math.abs(deltaX) > 4) {
        dragStateRef.current.didDrag = true
        if (!isDragging) {
          setIsDragging(true)
        }
      }

      if (!dragStateRef.current.didDrag) return

      event.preventDefault()
      container.scrollLeft = dragStateRef.current.scrollLeft - deltaX
    },
    [dragScroll, isDragging]
  )

  const handlePointerUp = React.useCallback(() => {
    stopDragging()
  }, [stopDragging])

  const handlePointerCancel = React.useCallback(() => {
    stopDragging()
  }, [stopDragging])

  const handleClickCapture = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!dragScroll || !dragStateRef.current.didDrag) return

      event.preventDefault()
      event.stopPropagation()
      dragStateRef.current.didDrag = false
    },
    [dragScroll]
  )

  return (
    <div
      ref={containerRef}
      data-slot="table-container"
      className={cn(
        "relative w-full overflow-x-auto",
        dragScroll && "cursor-grab",
        isDragging && "cursor-grabbing select-none",
        containerClassName
      )}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
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