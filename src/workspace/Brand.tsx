export default function Brand() {
  return (
    <span className="inline-flex items-center gap-2 whitespace-nowrap text-xl font-extrabold tracking-[-.06em] text-primary">
      <img src={`${import.meta.env.BASE_URL}icons/budgetmate-192.png`} alt="" className="size-9 shrink-0 rounded-xl" />
      budgetmate
    </span>
  )
}
