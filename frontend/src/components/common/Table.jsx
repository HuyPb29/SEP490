import styles from './CommonUI.module.css';

export function Table({
  columns,
  data = [],
  rowKey = 'id',
  emptyText = 'Chưa có dữ liệu.',
  className = '',
  children,
}) {
  if (children) {
    return (
      <div className={[styles.tableContainer, className].filter(Boolean).join(' ')}>
        <table className={styles.table}>{children}</table>
      </div>
    );
  }

  return (
    <div className={[styles.tableContainer, className].filter(Boolean).join(' ')}>
      <table className={styles.table}>
        <thead>
          <tr>
            {columns?.map((col) => (
              <th key={col.key} style={col.align ? { textAlign: col.align } : undefined}>
                {col.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.length === 0 ? (
            <tr>
              <td colSpan={columns?.length || 1} style={{ textAlign: 'center', padding: '20px 14px' }}>
                {emptyText}
              </td>
            </tr>
          ) : (
            data.map((row, idx) => {
              const keyVal = typeof rowKey === 'function' ? rowKey(row, idx) : row[rowKey] ?? idx;
              return (
                <tr key={keyVal}>
                  {columns?.map((col) => (
                    <td key={col.key} style={col.align ? { textAlign: col.align } : undefined}>
                      {col.render ? col.render(row, idx) : row[col.key]}
                    </td>
                  ))}
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}

export default Table;
