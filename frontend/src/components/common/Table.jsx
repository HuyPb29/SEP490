import { useLayoutEffect, useRef } from 'react';
import styles from './CommonUI.module.css';

export function Table({
  columns,
  data = [],
  rowKey = 'id',
  emptyText = 'Chưa có dữ liệu.',
  className = '',
  children,
}) {
  const tableRef = useRef(null);
  // Support both the columns API and existing native thead/tbody consumers.
  useLayoutEffect(() => {
    const table = tableRef.current;
    if (!table) return;
    const labels = Array.from(table.querySelectorAll('thead tr:last-child th'), (cell) => cell.textContent.trim());
    table.querySelectorAll('tbody tr').forEach((row) => {
      let index = 0;
      Array.from(row.cells).forEach((cell) => {
        if (cell.colSpan === 1) cell.dataset.label = labels[index] || '';
        index += cell.colSpan;
      });
    });
  });
  if (children) {
    return (
      <div className={[styles.tableContainer, className].filter(Boolean).join(' ')}>
        <table ref={tableRef} className={styles.table}>{children}</table>
      </div>
    );
  }

  return (
    <div className={[styles.tableContainer, className].filter(Boolean).join(' ')}>
      <table ref={tableRef} className={styles.table}>
        <thead>
          <tr>
            {columns?.map((col) => (
              <th scope="col" key={col.key} style={col.align ? { textAlign: col.align } : undefined}>
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
