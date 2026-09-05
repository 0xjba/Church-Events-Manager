import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';

/**
 * The event level the admin is working in.
 *
 * Everything below a level — participants, groups, events, results — belongs to
 * it, and chest numbers restart in each. Holding the choice here means a screen
 * cannot forget to apply it, which is how participants from a put-away level
 * kept appearing.
 *
 * Only active levels are offered; an inactive one is put away everywhere except
 * the event levels page, where it can be brought back.
 */

export interface EventLevelOption {
  id: string;
  name: string;
  year: number;
  scope: 'church' | 'district' | 'state';
  results_published: boolean;
}

interface EventLevelContextValue {
  levels: EventLevelOption[];
  levelId: string;
  level: EventLevelOption | null;
  setLevelId: (id: string) => void;
  loading: boolean;
  refresh: () => Promise<void>;
}

const STORAGE_KEY = 'pypa.event-level';

const EventLevelContext = createContext<EventLevelContextValue | undefined>(undefined);

export const useEventLevel = () => {
  const context = useContext(EventLevelContext);
  if (!context) throw new Error('useEventLevel must be used within an EventLevelProvider');
  return context;
};

export const EventLevelProvider = ({ children }: { children: React.ReactNode }) => {
  const [levels, setLevels] = useState<EventLevelOption[]>([]);
  const [levelId, setLevelId] = useState<string>(() => localStorage.getItem(STORAGE_KEY) ?? '');
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from('event_levels')
        .select('id, name, year, scope, results_published')
        .eq('is_active', true)
        .order('year', { ascending: false });

      if (error) throw error;

      const active = (data ?? []) as unknown as EventLevelOption[];
      setLevels(active);

      // A remembered level that has since been put away must not linger.
      setLevelId((current) =>
        active.some((option) => option.id === current) ? current : active[0]?.id ?? '',
      );
    } catch (error) {
      console.error('Failed to load event levels:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (levelId) localStorage.setItem(STORAGE_KEY, levelId);
    else localStorage.removeItem(STORAGE_KEY);
  }, [levelId]);

  const value = useMemo(
    () => ({
      levels,
      levelId,
      level: levels.find((option) => option.id === levelId) ?? null,
      setLevelId,
      loading,
      refresh,
    }),
    [levels, levelId, loading, refresh],
  );

  return <EventLevelContext.Provider value={value}>{children}</EventLevelContext.Provider>;
};
