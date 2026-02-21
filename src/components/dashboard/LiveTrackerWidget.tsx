import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { BarChart3, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';

const STAGE_LABELS: Record<string, string> = {
  scheduled_jobs: 'Scheduled',
  making_price_files: 'Making Price Files',
  pricing_complete: 'Pricing Complete',
  files_built: 'Files Built',
  needs_automation: 'Needs Automation',
  jobs_on_hold: 'On Hold',
  ready_for_review: 'Ready for Review',
  out_on_draft: 'Out on Draft',
  in_for_updates: 'In for Updates',
  out_for_final: 'Out for Final',
  to_be_invoiced: 'To Be Invoiced',
};

const STAGE_COLORS: Record<string, string> = {
  scheduled_jobs: 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200',
  making_price_files: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200',
  pricing_complete: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200',
  files_built: 'bg-teal-100 text-teal-800 dark:bg-teal-900 dark:text-teal-200',
  needs_automation: 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200',
  jobs_on_hold: 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200',
  ready_for_review: 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200',
  out_on_draft: 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200',
  in_for_updates: 'bg-pink-100 text-pink-800 dark:bg-pink-900 dark:text-pink-200',
  out_for_final: 'bg-cyan-100 text-cyan-800 dark:bg-cyan-900 dark:text-cyan-200',
  to_be_invoiced: 'bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200',
};

export function LiveTrackerWidget() {
  const { data: stageCounts, isLoading } = useQuery({
    queryKey: ['dashboard-tracker-stages'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('live_tracker_jobs')
        .select('stage')
        .neq('stage', 'final_approved');
      if (error) throw error;
      const counts: Record<string, number> = {};
      (data || []).forEach(j => { counts[j.stage] = (counts[j.stage] || 0) + 1; });
      return counts;
    },
    staleTime: 30000,
    refetchInterval: 30000,
  });

  const total = Object.values(stageCounts || {}).reduce((a, b) => a + b, 0);
  const activeStages = Object.entries(stageCounts || {})
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-lg flex items-center gap-2">
          <BarChart3 className="h-5 w-5" />
          Live Tracker
        </CardTitle>
        <Button variant="ghost" size="sm" asChild>
          <Link to="/live-tracker">View All</Link>
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : total === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-4">No active jobs in pipeline</p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-3xl font-bold">{total}</span>
              <span className="text-sm text-muted-foreground">active jobs</span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {activeStages.map(([stage, count]) => (
                <Badge
                  key={stage}
                  variant="secondary"
                  className={`text-xs ${STAGE_COLORS[stage] || ''}`}
                >
                  {STAGE_LABELS[stage] || stage} ({count})
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
