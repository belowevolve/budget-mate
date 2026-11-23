export function SheetGrip() {
  return (
    <span data-sheet-grip aria-hidden="true"
      className="col-span-full -mb-1 -mt-1 hidden h-5 w-full shrink-0 touch-pan-y place-items-center in-data-[presentation=sheet]:grid">
      <span className="h-0.5 w-7 rounded-full bg-muted/45" />
    </span>
  )
}
