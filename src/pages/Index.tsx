import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { FolderPlus, Loader2, CalendarDays } from 'lucide-react';

const Index = () => {
  const { isLoading, roles } = useAuth();

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const hasRole = roles.length > 0;

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Projects</h1>
            <p className="text-muted-foreground mt-1">
              Hospital audit projects sorted by date
            </p>
          </div>
          {hasRole && (
            <Button className="gap-2">
              <FolderPlus className="h-4 w-4" />
              New Project
            </Button>
          )}
        </div>

        {!hasRole ? (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                <CalendarDays className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg">No Role Assigned</h3>
              <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
                Your account has been created. Please wait for a manager to assign you a role (Scanner or Manager).
              </p>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed">
            <CardContent className="py-16 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
                <FolderPlus className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-lg">No Projects Yet</h3>
              <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
                Create your first hospital audit project to get started.
              </p>
              <Button className="mt-6 gap-2">
                <FolderPlus className="h-4 w-4" />
                Create Project
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </AppLayout>
  );
};

export default Index;
