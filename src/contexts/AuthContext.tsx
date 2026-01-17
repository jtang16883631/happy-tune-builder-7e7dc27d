import { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';

type AppRole = 'auditor' | 'developer' | 'coordinator' | 'owner' | 'office_admin';

interface UserWithRole {
  user: User | null;
  session: Session | null;
  roles: AppRole[];
  isOwner: boolean;
  isDeveloper: boolean;
  isCoordinator: boolean;
  isAuditor: boolean;
  isPrivileged: boolean; // developer or owner
  isLoading: boolean;
}

interface AuthContextType extends UserWithRole {
  signInWithGoogle: () => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  refreshRoles: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [roles, setRoles] = useState<AppRole[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const hardSignOut = useCallback(async () => {
    try {
      await supabase.auth.signOut();
    } finally {
      setUser(null);
      setSession(null);
      setRoles([]);
    }
  }, []);

  const fetchUserRoles = async (userId: string, retry: boolean = true): Promise<AppRole[]> => {
    const { data, error } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', userId);

    if (error) {
      // Token过期：尝试刷新一次，否则强制退出让用户重新登录
      if (retry && (error as any)?.code === 'PGRST303') {
        const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
        if (!refreshError && refreshed.session) {
          return fetchUserRoles(userId, false);
        }
        await hardSignOut();
      }

      console.error('Error fetching roles:', error);
      return [];
    }

    return (data || []).map((r) => r.role as AppRole);
  };

  // Ensure profile exists for the user (handles re-login after profile deletion)
  const ensureProfileExists = async (user: User, retry: boolean = true) => {
    const { data: existingProfile, error: profileError } = await supabase
      .from('profiles')
      .select('id')
      .eq('id', user.id)
      .single();

    if (profileError) {
      if (retry && (profileError as any)?.code === 'PGRST303') {
        const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
        if (!refreshError && refreshed.session) {
          return ensureProfileExists(user, false);
        }
        await hardSignOut();
        return;
      }

      // 忽略“找不到记录”的情况，其它错误打印出来
      if ((profileError as any)?.code !== 'PGRST116') {
        console.error('Error checking profile:', profileError);
      }
    }

    if (!existingProfile) {
      const { error } = await supabase.from('profiles').insert({
        id: user.id,
        email: user.email,
        full_name: user.user_metadata?.full_name || user.user_metadata?.name || null,
        avatar_url: user.user_metadata?.avatar_url || null,
        profile_completed: false,
      });

      if (error) {
        if (retry && (error as any)?.code === 'PGRST303') {
          const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
          if (!refreshError && refreshed.session) {
            return ensureProfileExists(user, false);
          }
          await hardSignOut();
          return;
        }
        console.error('Error creating profile:', error);
      }
    }
  };

  const refreshRoles = async () => {
    if (user) {
      const userRoles = await fetchUserRoles(user.id);
      setRoles(userRoles);
    }
  };

  useEffect(() => {
    // Set up auth state listener FIRST
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        // Defer profile check and role fetching to avoid deadlock
        if (session?.user) {
          setTimeout(async () => {
            // Ensure profile exists (handles re-login after deletion)
            await ensureProfileExists(session.user);
            const userRoles = await fetchUserRoles(session.user.id);
            setRoles(userRoles);
            setIsLoading(false);
          }, 0);
        } else {
          setRoles([]);
          setIsLoading(false);
        }
      }
    );

    // THEN check for existing session
    supabase.auth.getSession().then(async ({ data: { session } }) => {
      let nextSession = session;

      // 如果已接近过期，主动刷新一次，避免后续请求直接 401
      const nowSec = Math.floor(Date.now() / 1000);
      if (nextSession?.expires_at && nextSession.expires_at - nowSec < 60) {
        const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
        if (!refreshError && refreshed.session) {
          nextSession = refreshed.session;
        } else {
          await hardSignOut();
          setIsLoading(false);
          return;
        }
      }

      setSession(nextSession);
      setUser(nextSession?.user ?? null);

      if (nextSession?.user) {
        await ensureProfileExists(nextSession.user);
        const userRoles = await fetchUserRoles(nextSession.user.id);
        setRoles(userRoles);
      }
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [fetchUserRoles, ensureProfileExists, hardSignOut]);

  useEffect(() => {
    if (!session) return;

    const interval = window.setInterval(async () => {
      const nowSec = Math.floor(Date.now() / 1000);
      const expiresAt = session.expires_at;
      if (!expiresAt) return;

      // 60秒内过期就刷新
      if (expiresAt - nowSec < 60) {
        const { data: refreshed, error: refreshError } = await supabase.auth.refreshSession();
        if (!refreshError && refreshed.session) {
          setSession(refreshed.session);
          setUser(refreshed.session.user ?? null);
        } else {
          await hardSignOut();
        }
      }
    }, 30_000);

    return () => window.clearInterval(interval);
  }, [session, hardSignOut]);

  const signInWithGoogle = async () => {
    const redirectUrl = `${window.location.origin}/`;
    
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: redirectUrl,
      },
    });

    return { error: error as Error | null };
  };

  const signOut = async () => {
    await hardSignOut();
  };

  const isOwner = roles.includes('owner');
  const isDeveloper = roles.includes('developer');
  const isCoordinator = roles.includes('coordinator');
  const isAuditor = roles.includes('auditor');
  const isPrivileged = isOwner || isDeveloper;

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        roles,
        isOwner,
        isDeveloper,
        isCoordinator,
        isAuditor,
        isPrivileged,
        isLoading,
        signInWithGoogle,
        signOut,
        refreshRoles,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}