import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Lightbulb, Plus, Pencil, Trash2, Loader2, CheckCircle, Clock, XCircle, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

interface Suggestion {
  id: string;
  user_id: string;
  title: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

interface Profile {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
}

const statusConfig: Record<string, { label: string; icon: React.ElementType; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'Pending', icon: Clock, variant: 'secondary' },
  reviewed: { label: 'Reviewed', icon: Eye, variant: 'outline' },
  implemented: { label: 'Implemented', icon: CheckCircle, variant: 'default' },
  declined: { label: 'Declined', icon: XCircle, variant: 'destructive' },
};

const Suggestion = () => {
  const { user, isPrivileged } = useAuth();
  const queryClient = useQueryClient();
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSuggestion, setEditingSuggestion] = useState<Suggestion | null>(null);
  const [formData, setFormData] = useState({
    title: '',
    description: '',
  });

  // Fetch suggestions
  const { data: suggestions = [], isLoading } = useQuery({
    queryKey: ['suggestions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('suggestions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Suggestion[];
    },
  });

  // Fetch profiles for user names
  const { data: profiles = [] } = useQuery({
    queryKey: ['profiles-for-suggestions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url');

      if (error) throw error;
      return data as Profile[];
    },
  });

  const getProfile = (userId: string) => profiles.find(p => p.id === userId);

  // Insert mutation
  const insertMutation = useMutation({
    mutationFn: async (entry: { title: string; description: string | null; user_id: string }) => {
      const { error } = await supabase.from('suggestions').insert(entry);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suggestions'] });
      toast.success('Suggestion submitted');
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error(`Failed to submit: ${error.message}`);
    },
  });

  // Update mutation
  const updateMutation = useMutation({
    mutationFn: async ({ id, ...entry }: { id: string; title: string; description: string | null }) => {
      const { error } = await supabase
        .from('suggestions')
        .update(entry)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suggestions'] });
      toast.success('Suggestion updated');
      setIsDialogOpen(false);
    },
    onError: (error: Error) => {
      toast.error(`Failed to update: ${error.message}`);
    },
  });

  // Update status mutation (for privileged users)
  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const { error } = await supabase
        .from('suggestions')
        .update({ status })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suggestions'] });
      toast.success('Status updated');
    },
    onError: (error: Error) => {
      toast.error(`Failed to update status: ${error.message}`);
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('suggestions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['suggestions'] });
      toast.success('Suggestion deleted');
    },
    onError: (error: Error) => {
      toast.error(`Failed to delete: ${error.message}`);
    },
  });

  const openAddDialog = () => {
    setEditingSuggestion(null);
    setFormData({
      title: '',
      description: '',
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (suggestion: Suggestion) => {
    setEditingSuggestion(suggestion);
    setFormData({
      title: suggestion.title,
      description: suggestion.description || '',
    });
    setIsDialogOpen(true);
  };

  const handleSave = () => {
    if (!formData.title.trim()) {
      toast.error('Please enter a title');
      return;
    }

    if (editingSuggestion) {
      updateMutation.mutate({
        id: editingSuggestion.id,
        title: formData.title.trim(),
        description: formData.description.trim() || null,
      });
    } else {
      insertMutation.mutate({
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        user_id: user!.id,
      });
    }
  };

  const handleDelete = (id: string) => {
    deleteMutation.mutate(id);
  };

  const isSaving = insertMutation.isPending || updateMutation.isPending;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Suggestions</h1>
            <p className="text-muted-foreground">
              Share your ideas and feedback for improving the portal
            </p>
          </div>
          <Button onClick={openAddDialog} size="sm">
            <Plus className="h-4 w-4 mr-1" />
            New Suggestion
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lightbulb className="h-5 w-5" />
              All Suggestions
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ScrollArea className="h-[calc(100vh-280px)]">
              {isLoading ? (
                <div className="space-y-4">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="p-4 rounded-lg border">
                      <Skeleton className="h-6 w-48 mb-2" />
                      <Skeleton className="h-4 w-full mb-1" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                  ))}
                </div>
              ) : suggestions.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground">
                  <Lightbulb className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p>No suggestions yet. Be the first to share an idea!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {suggestions.map((suggestion) => {
                    const profile = getProfile(suggestion.user_id);
                    const statusInfo = statusConfig[suggestion.status] || statusConfig.pending;
                    const StatusIcon = statusInfo.icon;
                    const isOwner = user?.id === suggestion.user_id;

                    return (
                      <div
                        key={suggestion.id}
                        className="p-4 rounded-lg border group hover:border-primary/50 transition-colors"
                      >
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="font-semibold text-lg">{suggestion.title}</h3>
                              <Badge variant={statusInfo.variant} className="flex items-center gap-1">
                                <StatusIcon className="h-3 w-3" />
                                {statusInfo.label}
                              </Badge>
                            </div>
                            {suggestion.description && (
                              <p className="text-muted-foreground mb-3">{suggestion.description}</p>
                            )}
                            <div className="flex items-center gap-3 text-sm text-muted-foreground">
                              <div className="flex items-center gap-2">
                                <Avatar className="h-5 w-5">
                                  <AvatarImage src={profile?.avatar_url || undefined} />
                                  <AvatarFallback className="text-xs">
                                    {profile?.full_name?.[0] || 'U'}
                                  </AvatarFallback>
                                </Avatar>
                                <span>{profile?.full_name || 'Unknown'}</span>
                              </div>
                              <span>•</span>
                              <span>{format(new Date(suggestion.created_at), 'MMM d, yyyy')}</span>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            {isPrivileged && (
                              <Select
                                value={suggestion.status}
                                onValueChange={(value) =>
                                  updateStatusMutation.mutate({ id: suggestion.id, status: value })
                                }
                              >
                                <SelectTrigger className="w-32 h-8">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="pending">Pending</SelectItem>
                                  <SelectItem value="reviewed">Reviewed</SelectItem>
                                  <SelectItem value="implemented">Implemented</SelectItem>
                                  <SelectItem value="declined">Declined</SelectItem>
                                </SelectContent>
                              </Select>
                            )}
                            {isOwner && (
                              <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                  onClick={() => openEditDialog(suggestion)}
                                >
                                  <Pencil className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-destructive"
                                  onClick={() => handleDelete(suggestion.id)}
                                  disabled={deleteMutation.isPending}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingSuggestion ? 'Edit Suggestion' : 'New Suggestion'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                placeholder="Brief summary of your idea"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                placeholder="Provide more details about your suggestion..."
                rows={5}
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={isSaving}>
              {isSaving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {editingSuggestion ? 'Update' : 'Submit'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  );
};

export default Suggestion;
