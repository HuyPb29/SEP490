export default function LoadingSpinner({ message = 'Loading...' }) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '240px',
        padding: '40px 20px',
        color: '#475569',
        fontSize: '14px',
        fontWeight: 500,
        gap: '12px',
      }}
    >
      <div
        style={{
          width: '36px',
          height: '36px',
          border: '3px solid #e2e8f0',
          borderTopColor: '#16a34a',
          borderRadius: '50%',
          animation: 'courtlySpinner 0.8s linear infinite',
        }}
      />
      <style>{`@keyframes courtlySpinner { to { transform: rotate(360deg); } }`}</style>
      {message && <span>{message}</span>}
    </div>
  )
}
