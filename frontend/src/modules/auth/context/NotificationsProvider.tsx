import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { io, type Socket } from 'socket.io-client';
import { getAccessToken } from '../../../lib/api/token-storage';
import { emitInAppNotification } from '../../../lib/notification-events';
import { useAuth } from '../hooks/useAuth';
import {
  fetchNotifications,
  markNotificationRead,
  type InAppNotification,
} from '../api/notifications-api';

const WS_BASE =
  import.meta.env.VITE_WS_BASE_URL ?? 'http://localhost:3000';

type ToastState = {
  id: string;
  titulo: string;
  mensaje: string;
} | null;

type NotificationsContextValue = {
  items: InAppNotification[];
  unread: number;
  toast: ToastState;
  dismissToast: () => void;
  refresh: () => Promise<void>;
  marcarLeida: (notificationId: string) => Promise<void>;
};

const NotificationsContext = createContext<NotificationsContextValue | null>(
  null,
);

export function NotificationsProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [items, setItems] = useState<InAppNotification[]>([]);
  const [unread, setUnread] = useState(0);
  const [toast, setToast] = useState<ToastState>(null);
  const socketRef = useRef<Socket | null>(null);
  const toastTimerRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setItems([]);
      setUnread(0);
      return;
    }
    try {
      const data = await fetchNotifications({ read: false, limit: 20 });
      setItems(data.items);
      setUnread(data.total);
    } catch {
      // Keep last known state.
    }
  }, [user]);

  const showToast = useCallback((titulo: string, mensaje: string) => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
    }
    const id = `${Date.now()}`;
    setToast({ id, titulo, mensaje });
    toastTimerRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimerRef.current = null;
    }, 5000);
  }, []);

  const dismissToast = useCallback(() => {
    if (toastTimerRef.current) {
      window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = null;
    }
    setToast(null);
  }, []);

  const marcarLeida = useCallback(async (notificationId: string) => {
    await markNotificationRead(notificationId);
    setItems((current) =>
      current.filter((item) => item.notification_id !== notificationId),
    );
    setUnread((count) => Math.max(0, count - 1));
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (!user) {
      socketRef.current?.disconnect();
      socketRef.current = null;
      return;
    }

    const token = getAccessToken();
    if (!token) {
      return;
    }

    const socket = io(`${WS_BASE}/notifications`, {
      auth: { token },
      transports: ['websocket', 'polling'],
    });
    socketRef.current = socket;

    socket.on('notification', (payload: InAppNotification) => {
      setItems((current) => {
        if (current.some((n) => n.notification_id === payload.notification_id)) {
          return current;
        }
        return [payload, ...current];
      });
      setUnread((count) => count + 1);
      showToast(payload.titulo, payload.mensaje);
      emitInAppNotification({
        event_type: payload.event_type,
        entity_type: payload.entity_type,
        entity_id: payload.entity_id,
        titulo: payload.titulo,
      });
    });

    return () => {
      socket.disconnect();
      socketRef.current = null;
    };
  }, [user, showToast]);

  useEffect(() => {
    return () => {
      if (toastTimerRef.current) {
        window.clearTimeout(toastTimerRef.current);
      }
    };
  }, []);

  const value = useMemo(
    () => ({
      items,
      unread,
      toast,
      dismissToast,
      refresh,
      marcarLeida,
    }),
    [items, unread, toast, dismissToast, refresh, marcarLeida],
  );

  return (
    <NotificationsContext.Provider value={value}>
      {children}
    </NotificationsContext.Provider>
  );
}

export function useNotifications(): NotificationsContextValue {
  const ctx = useContext(NotificationsContext);
  if (!ctx) {
    throw new Error('useNotifications must be used within NotificationsProvider');
  }
  return ctx;
}
