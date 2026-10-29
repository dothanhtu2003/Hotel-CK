import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import '@fontsource/be-vietnam-pro/400.css';
import '@fontsource/be-vietnam-pro/500.css';
import '@fontsource/be-vietnam-pro/600.css';
import '@fontsource/cormorant-garamond/400.css';
import '@fontsource/cormorant-garamond/500.css';
import '@fontsource/cormorant-garamond/400-italic.css';
import { AuthProvider } from './features/auth/auth-provider';
import { ToastProvider } from './components/toast-provider';
import { App } from './app';
import './styles.css';
import './features/reception/operations.css';

const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false, networkMode: 'always', refetchOnWindowFocus: true }, mutations: { retry: false, networkMode: 'always' } } });
createRoot(document.getElementById('root')!).render(<StrictMode><QueryClientProvider client={queryClient}><ToastProvider><AuthProvider><App /></AuthProvider></ToastProvider></QueryClientProvider></StrictMode>);
