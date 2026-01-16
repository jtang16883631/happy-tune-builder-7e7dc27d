import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, ScanBarcode, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';

const Scan = () => {
  const { isLoading, roles } = useAuth();
  const navigate = useNavigate();

  const hasRole = roles.length > 0;

  useEffect(() => {
    if (!isLoading && !hasRole) {
      navigate('/');
    }
  }, [isLoading, hasRole, navigate]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Scanner</h1>
          <p className="text-muted-foreground mt-1">
            Scan barcodes to lookup NDC and log items
          </p>
        </div>

        <Card className="border-dashed">
          <CardContent className="py-16 text-center">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted mb-4">
              <ScanBarcode className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-lg">Scanner Coming Soon</h3>
            <p className="text-muted-foreground mt-2 max-w-sm mx-auto">
              First, we need to set up projects, upload FDA data, and configure sections.
            </p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default Scan;
