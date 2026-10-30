type Complement = { id: string; categoria_id: string | null }

/** Keep existing partial/legacy links intact until the merchant explicitly toggles a list. */
export function complementListState(selected: string[], complements: Complement[], listId: string) {
  const ids = complements.filter(item => item.categoria_id === listId).map(item => item.id)
  const selectedSet = new Set(selected)
  const count = ids.filter(id => selectedSet.has(id)).length
  return { ids, all: ids.length > 0 && count === ids.length, partial: count > 0 && count < ids.length }
}

export function toggleComplementList(selected: string[], complements: Complement[], listId: string): string[] {
  const state = complementListState(selected, complements, listId)
  if (!state.ids.length) return selected
  const next = new Set(selected)
  for (const id of state.ids) {
    if (state.all) next.delete(id)
    else next.add(id)
  }
  return [...next]
}
