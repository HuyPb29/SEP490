import { Link } from 'react-router-dom';

export function formatMoney(value) {
  return `${Number(value || 0).toLocaleString('vi-VN')} đ`;
}

export function formatMinute(minute) {
  const m = Number(minute || 0);
  return `${String(Math.floor(m / 60) % 24).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
}

export function formatDateTime(value) {
  return value ? new Date(value).toLocaleString('vi-VN') : '';
}

export function PageShell({ title, subtitle, actions, children }) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="bg-[#06101c] text-white">
        <div className="max-w-5xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
          <Link to="/" className="font-extrabold text-lg">BMS</Link>
          <nav className="flex gap-4 text-sm text-slate-300 flex-wrap justify-end">
            <Link to="/teams" className="hover:text-white">Đội</Link>
            <Link to="/matches" className="hover:text-white">Kèo</Link>
            <Link to="/complaints" className="hover:text-white">Khiếu nại</Link>
            <Link to="/staff/dashboard" className="hover:text-white">Điều hành</Link>
            <Link to="/owner/reviews" className="hover:text-white">Đánh giá</Link>
            <Link to="/owner/reports" className="hover:text-white">Báo cáo</Link>
          </nav>
        </div>
      </header>
      <main className="max-w-5xl mx-auto px-4 py-6">
        <div className="flex items-start justify-between gap-4 mb-5">
          <div>
            <h1 className="text-2xl font-bold">{title}</h1>
            {subtitle && <p className="text-sm text-slate-500 mt-1">{subtitle}</p>}
          </div>
          {actions}
        </div>
        {children}
      </main>
    </div>
  );
}

export function Card({ title, children, className = '' }) {
  return (
    <section className={`bg-white border border-slate-200 rounded-xl p-4 shadow-sm ${className}`}>
      {title && <h2 className="font-semibold mb-3">{title}</h2>}
      {children}
    </section>
  );
}

export function Notice({ error, success }) {
  if (error) return <div className="mb-4 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm px-3 py-2">{error}</div>;
  if (success) return <div className="mb-4 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-3 py-2">{success}</div>;
  return null;
}

export function Empty({ children = 'Chưa có dữ liệu' }) {
  return <p className="text-sm text-slate-500 py-6 text-center">{children}</p>;
}

const BUTTON_STYLES = {
  primary: 'bg-emerald-600 hover:bg-emerald-700 text-white',
  secondary: 'bg-white hover:bg-slate-100 text-slate-700 border border-slate-300',
  danger: 'bg-red-600 hover:bg-red-700 text-white',
};

export function Button({ variant = 'primary', className = '', ...props }) {
  return (
    <button
      type="button"
      {...props}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium disabled:opacity-50 disabled:cursor-not-allowed ${BUTTON_STYLES[variant]} ${className}`}
    />
  );
}

export function Field({ label, children }) {
  return (
    <label className="block text-sm mb-3">
      <span className="block text-slate-600 mb-1">{label}</span>
      {children}
    </label>
  );
}

export const inputClass =
  'w-full border border-slate-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500';

const BADGE_TONES = {
  green: 'bg-emerald-100 text-emerald-700',
  amber: 'bg-amber-100 text-amber-700',
  red: 'bg-red-100 text-red-700',
  slate: 'bg-slate-100 text-slate-600',
};

export function Badge({ tone = 'slate', children }) {
  return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${BADGE_TONES[tone]}`}>{children}</span>;
}

export function Pager({ page, onChange }) {
  if (!page || page.totalPages <= 1) return null;
  return (
    <div className="flex items-center justify-center gap-3 mt-4 text-sm">
      <Button variant="secondary" disabled={page.pageNumber === 0} onClick={() => onChange(page.pageNumber - 1)}>Trước</Button>
      <span>Trang {page.pageNumber + 1}/{page.totalPages}</span>
      <Button variant="secondary" disabled={page.isLast} onClick={() => onChange(page.pageNumber + 1)}>Sau</Button>
    </div>
  );
}
