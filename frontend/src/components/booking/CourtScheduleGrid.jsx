export default function CourtScheduleGrid({
  courts,
  timeHeaders,
  selectedSlots,
  playDate,
  mode,
  onToggleSlot,
  styles,
}) {
  const isSelected = (courtId, timeIdx) => selectedSlots.some((selected) => (
    selected.courtId === courtId && selected.timeIdx === timeIdx &&
    (mode === 'recurring' || selected.date === playDate)
  ))

  return (
    <div className={styles.tableWrapper}>
      <table className={styles.scheduleTable}>
        <thead>
          <tr>
            <th className={styles.courtColHeader}>Court</th>
            {timeHeaders.map((time) => <th key={time}>{time}</th>)}
          </tr>
        </thead>
        <tbody>
          {courts.map((court) => (
            <tr key={court.court_id}>
              <td className={styles.courtNameCell}>{court.court_name}</td>
              {court.slots.map((slot, timeIdx) => {
                const selected = isSelected(court.court_id, timeIdx)
                let buttonClass = styles.slotAvailable
                let label = `${slot.price / 1000}k`
                if (selected) {
                  buttonClass = styles.slotSelected
                  label = 'Selected'
                } else if (slot.status === 'booked') {
                  buttonClass = styles.slotBooked
                  label = 'Booked'
                } else if (slot.status === 'holding') {
                  buttonClass = styles.slotHolding
                  label = 'Holding'
                } else if (slot.status === 'maintenance') {
                  buttonClass = styles.slotMaintenance
                  label = 'Maint.'
                }

                return (
                  <td key={slot.time}>
                    <button
                      type="button"
                      className={`${styles.slotBtn} ${buttonClass}`}
                      disabled={slot.status !== 'available'}
                      aria-pressed={selected}
                      onClick={() => onToggleSlot(court, slot, timeIdx)}
                    >
                      {label}
                    </button>
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}