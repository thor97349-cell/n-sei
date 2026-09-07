interface ToastProps {
  message?: string;
}

export default function Toast({ message }: ToastProps) {
  if (!message) return null;

  return (
    <div
      role="status"
      className="toast-msg pointer-events-none fixed left-1/2 top-4 z-50 -translate-x-1/2 rounded-full bg-success px-5 py-2.5 text-sm font-semibold text-white shadow-lg"
    >
      {message}
    </div>
  );
}
