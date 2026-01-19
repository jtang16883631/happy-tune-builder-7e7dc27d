import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface PresenceUser {
  id: string;
  email: string;
  fullName: string;
  avatarUrl?: string;
  onlineAt: string;
}

export function usePresence() {
  const { user } = useAuth();
  const [presentUsers, setPresentUsers] = useState<PresenceUser[]>([]);
  const [currentUserPresence, setCurrentUserPresence] = useState<PresenceUser | null>(null);

  useEffect(() => {
    if (!user) return;

    const channel = supabase.channel('app-presence', {
      config: { presence: { key: user.id } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        const state = channel.presenceState();
        const users: PresenceUser[] = [];
        
        Object.values(state).forEach((presences: any[]) => {
          presences.forEach((presence) => {
            users.push({
              id: presence.id,
              email: presence.email,
              fullName: presence.fullName,
              avatarUrl: presence.avatarUrl,
              onlineAt: presence.onlineAt,
            });
          });
        });

        // Separate current user from others
        const me = users.find(u => u.id === user.id);
        const others = users.filter(u => u.id !== user.id);
        
        setCurrentUserPresence(me || null);
        setPresentUsers(others);
      })
      .subscribe(async (status) => {
        if (status !== 'SUBSCRIBED') return;

        // Fetch current user's profile for display
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, avatar_url')
          .eq('id', user.id)
          .single();

        const myPresence: PresenceUser = {
          id: user.id,
          email: user.email || '',
          fullName: profile?.full_name || user.email?.split('@')[0] || 'User',
          avatarUrl: profile?.avatar_url || undefined,
          onlineAt: new Date().toISOString(),
        };

        setCurrentUserPresence(myPresence);

        await channel.track({
          id: user.id,
          email: user.email || '',
          fullName: myPresence.fullName,
          avatarUrl: myPresence.avatarUrl,
          onlineAt: myPresence.onlineAt,
        });
      });

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user]);

  return { presentUsers, currentUserPresence, totalOnline: presentUsers.length + (currentUserPresence ? 1 : 0) };
}
