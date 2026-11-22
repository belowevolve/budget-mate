export function SheetGrip() {
  return (
    <span data-sheet-grip aria-hidden="true"
      className="col-span-full -mb-1 -mt-1 hidden h-5 w-full touch-pan-y place-items-center [[data-presentation=sheet]_&]:grid">
      <span className="h-1 w-9 rounded-full bg-muted/45" />
    </span>
  )
}
