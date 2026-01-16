import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { 
  Activity, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Eye, 
  FileText, 
  FolderSync, 
  Plus,
  TrendingUp
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

// Mock data for demonstration
const activeAudits = [
  { id: 'H-NTH-01', location: 'Northside Hospital', auditor: 'Mike Chen', status: 'In Progress', progress: 85, lastSync: '2m ago' },
  { id: 'H-NTH-02', location: 'Bondon Hospital', auditor: 'Mike Chen', status: 'In Progress', progress: 85, lastSync: '1m ago' },
  { id: 'H-NTH-03', location: 'St. Marys Hospital', auditor: 'Sarah Name', status: 'Reviewing', progress: 75, lastSync: '2m ago' },
  { id: 'H-NTH-04', location: 'Northside Hospital', auditor: 'Mike Chen', status: 'Reviewing', progress: 75, lastSync: '1m ago' },
  { id: 'H-NTH-05', location: 'Northside Hospital', auditor: 'Sarah Name', status: 'In Progress', progress: 85, lastSync: '12m ago' },
];

const activityFeed = [
  { time: '10:45 AM', user: 'Sarah', message: 'Reported "Barcodes damaged in Section C" at St. Mary\'s' },
  { time: '10:30 AM', user: 'Mike', message: 'Completed Section B scan at Northside Hospital' },
  { time: '10:15 AM', user: 'Sarah', message: 'Started audit at Bondon Hospital' },
];

export default function Dashboard() {
  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Page Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Dashboard Overview</h1>
            <p className="text-muted-foreground">Monitor audit progress and field activities</p>
          </div>
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            New Audit
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Today's Active Audits
              </CardTitle>
              <Badge variant="outline" className="text-primary border-primary">
                Status
              </Badge>
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">5</div>
              <p className="text-sm text-green-600 flex items-center gap-1 mt-1">
                <TrendingUp className="h-4 w-4" />
                2 Near Completion
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Real-time Progress
              </CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">74%</div>
              <p className="text-sm text-muted-foreground mt-1">Across all sites</p>
              <Progress value={74} className="mt-3 h-2" />
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">
                Field Issues
              </CardTitle>
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-4xl font-bold">3 Open</div>
              <p className="text-sm text-destructive mt-1">Requires Office Attention</p>
            </CardContent>
          </Card>
        </div>

        {/* Main Content Grid */}
        <div className="grid gap-6 lg:grid-cols-3">
          {/* Live Audit Tracker */}
          <Card className="lg:col-span-2">
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="text-lg">Live Audit Tracker</CardTitle>
              <Badge variant="secondary">60%</Badge>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Hospital ID</TableHead>
                    <TableHead>Location</TableHead>
                    <TableHead>Lead Auditor</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>% Done</TableHead>
                    <TableHead>Last Sync</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {activeAudits.map((audit) => (
                    <TableRow key={audit.id}>
                      <TableCell className="font-medium">{audit.id}</TableCell>
                      <TableCell>{audit.location}</TableCell>
                      <TableCell>{audit.auditor}</TableCell>
                      <TableCell>
                        <Badge 
                          variant={audit.status === 'In Progress' ? 'default' : 'secondary'}
                          className={audit.status === 'In Progress' ? 'bg-blue-500' : 'bg-amber-500'}
                        >
                          {audit.status}
                        </Badge>
                      </TableCell>
                      <TableCell>{audit.progress}%</TableCell>
                      <TableCell className="text-muted-foreground">{audit.lastSync}</TableCell>
                      <TableCell>
                        <Button variant="link" size="sm" className="p-0 h-auto text-primary">
                          <Eye className="h-4 w-4 mr-1" />
                          View Live
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Activity Feed */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Field Activity Feed</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {activityFeed.map((activity, index) => (
                <div key={index} className="flex gap-3 text-sm">
                  <div className="flex-shrink-0 mt-1">
                    <div className="h-2 w-2 rounded-full bg-primary" />
                  </div>
                  <div>
                    <span className="text-muted-foreground">{activity.time}</span>
                    <span className="mx-1">-</span>
                    <span className="font-medium">{activity.user}</span>
                    <p className="text-muted-foreground mt-0.5">{activity.message}</p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-3">
              <Button variant="outline" className="gap-2">
                <FileText className="h-4 w-4" />
                New Project Wizard
              </Button>
              <Button variant="outline" className="gap-2">
                <FolderSync className="h-4 w-4" />
                Sync Cost Data
              </Button>
              <Button variant="outline" className="gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Review Pending
              </Button>
              <Button variant="outline" className="gap-2">
                <Clock className="h-4 w-4" />
                View Schedule
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
