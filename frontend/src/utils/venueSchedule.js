export const isBookable = (slot) => slot.status === 'available' && slot.price != null && Number.isFinite(Number(slot.price))
