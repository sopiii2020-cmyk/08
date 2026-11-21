import { Component, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.tsx';
import './index.css';

interface ErrorBoundaryState {
  errorMessage: string | null;
}

class AppErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { errorMessage: null };

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { errorMessage: error?.message || 'خطای غیرمنتظره در رابط کاربری' };
  }

  render() {
    if (this.state.errorMessage) {
      return (
        <div className="min-h-screen bg-slate-50 p-6 flex items-center justify-center">
          <div className="bg-white border border-rose-200 rounded-2xl p-6 max-w-md w-full space-y-2 text-right">
            <h1 className="text-base font-bold text-rose-700">خطا در نمایش پنل</h1>
            <p className="text-sm text-slate-700">{this.state.errorMessage}</p>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const rootEl = document.getElementById('root')!;
rootEl.dataset.mounted = '1';
createRoot(rootEl).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>,
);
