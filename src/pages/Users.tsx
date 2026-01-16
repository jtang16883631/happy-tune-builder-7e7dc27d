import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { useNavigate } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { Loader2, UserCog, Shield, ScanBarcode } from 'lucide-react';

type AppRole = 'scanner' | 'manager';

interface Profile {
  id: string;
  email: string | null;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
}

interface UserRole {
  user_id: string;
  role: AppRole;
}

interface UserWithRoles extends Profile {
  roles: AppRole[];
}

const Users = () => {
  const { isManager, isLoading: authLoading, user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [users, setUsers] = useState<UserWithRoles[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !isManager) {
      navigate('/');
    }
  }, [authLoading, isManager, navigate]);

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    setIsLoading(true);
    try {
      const [profilesRes, rolesRes] = await Promise.all([
        supabase.from('profiles').select('*').order('created_at', { ascending: false }),
        supabase.from('user_roles').select('user_id, role'),
      ]);

      if (profilesRes.error) throw profilesRes.error;
      if (rolesRes.error) throw rolesRes.error;

      const rolesMap = new Map<string, AppRole[]>();
      (rolesRes.data || []).forEach((r: UserRole) => {
        const existing = rolesMap.get(r.user_id) || [];
        existing.push(r.role);
        rolesMap.set(r.user_id, existing);
      });

      const usersWithRoles: UserWithRoles[] = (profilesRes.data || []).map((p: Profile) => ({
        ...p,
        roles: rolesMap.get(p.id) || [],
      }));

      setUsers(usersWithRoles);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast({
        title: 'Error',
        description: 'Failed to load users',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleRoleChange = async (userId: string, newRole: AppRole | 'none') => {
    try {
      // First, delete existing roles for this user
      const { error: deleteError } = await supabase
        .from('user_roles')
        .delete()
        .eq('user_id', userId);

      if (deleteError) throw deleteError;

      // If a role is selected (not 'none'), insert the new role
      if (newRole !== 'none') {
        const { error: insertError } = await supabase.from('user_roles').insert({
          user_id: userId,
          role: newRole,
          assigned_by: user?.id,
        });

        if (insertError) throw insertError;
      }

      toast({
        title: 'Success',
        description: newRole === 'none' ? 'Role removed' : `Role updated to ${newRole}`,
      });

      fetchUsers();
    } catch (error) {
      console.error('Error updating role:', error);
      toast({
        title: 'Error',
        description: 'Failed to update role',
        variant: 'destructive',
      });
    }
  };

  const getInitials = (name?: string | null, email?: string | null) => {
    const displayName = name || email || 'U';
    return displayName
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  const getCurrentRole = (roles: AppRole[]): AppRole | 'none' => {
    if (roles.includes('manager')) return 'manager';
    if (roles.includes('scanner')) return 'scanner';
    return 'none';
  };

  if (authLoading || isLoading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">User Management</h1>
          <p className="text-muted-foreground mt-1">
            Assign roles to team members. Managers can scan and manage data.
          </p>
        </div>

        <div className="grid gap-4">
          {users.map((u) => {
            const currentRole = getCurrentRole(u.roles);
            const isCurrentUser = u.id === user?.id;

            return (
              <Card key={u.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-4">
                      <Avatar className="h-12 w-12">
                        <AvatarImage src={u.avatar_url || undefined} />
                        <AvatarFallback className="bg-primary text-primary-foreground">
                          {getInitials(u.full_name, u.email)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{u.full_name || 'Unnamed User'}</p>
                          {isCurrentUser && (
                            <Badge variant="outline" className="text-xs">
                              You
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{u.email}</p>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      {currentRole !== 'none' && (
                        <Badge
                          variant={currentRole === 'manager' ? 'default' : 'secondary'}
                          className="gap-1"
                        >
                          {currentRole === 'manager' ? (
                            <Shield className="h-3 w-3" />
                          ) : (
                            <ScanBarcode className="h-3 w-3" />
                          )}
                          {currentRole}
                        </Badge>
                      )}

                      <Select
                        value={currentRole}
                        onValueChange={(value) =>
                          handleRoleChange(u.id, value as AppRole | 'none')
                        }
                        disabled={isCurrentUser}
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue placeholder="Select role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Role</SelectItem>
                          <SelectItem value="scanner">Scanner</SelectItem>
                          <SelectItem value="manager">Manager</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}

          {users.length === 0 && (
            <Card>
              <CardContent className="py-12 text-center">
                <UserCog className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="font-medium text-lg">No users yet</h3>
                <p className="text-muted-foreground mt-1">
                  Users will appear here after they sign in with Google.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default Users;
