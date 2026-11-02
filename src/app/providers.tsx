import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { api } from '../api';
import type { Customer, ID } from '../domain/types';

/* ---------- active customer (tenant) ---------- */

interface CustomerCtx {
  customers: Customer[];
  customer: Customer | null;
  setCustomerId: (id: ID) => void;
}

const Ctx = createContext<CustomerCtx | null>(null);
const KEY = 'aybel.customer';

export function CustomerProvider({ children }: { children: ReactNode }) {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [id, setId] = useState<ID | null>(() => {
    try {
      return localStorage.getItem(KEY);
    } catch {
      return null;
    }
  });

  useEffect(() => {
    api.listCustomers().then(setCustomers).catch(console.error);
  }, []);

  const setCustomerId = useCallback((next: ID) => {
    setId(next);
    try {
      localStorage.setItem(KEY, next);
    } catch {
      /* storage unavailable */
    }
  }, []);

  const customer = customers.find((c) => c.id === id) ?? customers[0] ?? null;
  const value = useMemo(() => ({ customers, customer, setCustomerId }), [customers, customer, setCustomerId]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useCustomer() {
  const v = useContext(Ctx);
  if (!v) throw new Error('useCustomer outside CustomerProvider');
  return v;
}

/** Current customer id — pages only render once it is known. */
export function useCustomerId(): ID {
  const { customer } = useCustomer();
  if (!customer) throw new Error('No active customer');
  return customer.id;
}

/* ---------- theme ---------- */

type Theme = 'light' | 'dark';
const ThemeCtx = createContext<{ theme: Theme; toggle: () => void }>({ theme: 'light', toggle: () => {} });

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => (document.documentElement.dataset.theme as Theme) || 'light');
  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    try {
      localStorage.setItem('aybel.theme', theme);
    } catch {
      /* ignore */
    }
  }, [theme]);
  const toggle = useCallback(() => setTheme((t) => (t === 'light' ? 'dark' : 'light')), []);
  return <ThemeCtx.Provider value={{ theme, toggle }}>{children}</ThemeCtx.Provider>;
}

export const useTheme = () => useContext(ThemeCtx);
