import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AppLayout } from "@/components/layout/AppLayout";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { format, startOfWeek, endOfWeek, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, addDays } from "date-fns";
import { zhCN } from "date-fns/locale";
import { Plus, Clock, Calendar as CalendarIcon, BarChart3 } from "lucide-react";
import { TimesheetEntryDialog } from "@/components/timesheet/TimesheetEntryDialog";
import { TimesheetSummary } from "@/components/timesheet/TimesheetSummary";
import { TimesheetDayView } from "@/components/timesheet/TimesheetDayView";
import { useToast } from "@/hooks/use-toast";

interface TimesheetEntry {
  id: string;
  user_id: string;
  team_member_id: string | null;
  work_date: string;
  start_time: string | null;
  end_time: string | null;
  hours_worked: number;
  break_minutes: number | null;
  client_name: string | null;
  job_id: string | null;
  notes: string | null;
  status: string | null;
  created_at: string;
  updated_at: string;
}

interface TeamMember {
  id: string;
  name: string;
  color: string | null;
}

export default function Timesheet() {
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<TimesheetEntry | null>(null);
  const [viewMode, setViewMode] = useState<"day" | "week" | "month">("day");
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Fetch team members
  const { data: teamMembers = [] } = useQuery({
    queryKey: ["team-members-active"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("team_members")
        .select("id, name, color")
        .eq("is_active", true)
        .order("name");
      if (error) throw error;
      return data as TeamMember[];
    },
  });

  // Calculate date range based on view mode
  const getDateRange = () => {
    switch (viewMode) {
      case "week":
        return {
          start: startOfWeek(selectedDate, { weekStartsOn: 1 }),
          end: endOfWeek(selectedDate, { weekStartsOn: 1 }),
        };
      case "month":
        return {
          start: startOfMonth(selectedDate),
          end: endOfMonth(selectedDate),
        };
      default:
        return {
          start: selectedDate,
          end: selectedDate,
        };
    }
  };

  const dateRange = getDateRange();

  // Fetch timesheet entries for the date range
  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["timesheet-entries", format(dateRange.start, "yyyy-MM-dd"), format(dateRange.end, "yyyy-MM-dd")],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("timesheet_entries")
        .select("*")
        .gte("work_date", format(dateRange.start, "yyyy-MM-dd"))
        .lte("work_date", format(dateRange.end, "yyyy-MM-dd"))
        .order("work_date", { ascending: true })
        .order("start_time", { ascending: true });
      if (error) throw error;
      return data as TimesheetEntry[];
    },
  });

  // Delete mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("timesheet_entries").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["timesheet-entries"] });
      toast({ title: "已删除", description: "工时记录已成功删除" });
    },
    onError: (error) => {
      toast({ title: "删除失败", description: error.message, variant: "destructive" });
    },
  });

  const handleAddEntry = () => {
    setEditingEntry(null);
    setDialogOpen(true);
  };

  const handleEditEntry = (entry: TimesheetEntry) => {
    setEditingEntry(entry);
    setDialogOpen(true);
  };

  const handleDeleteEntry = (id: string) => {
    if (confirm("确定要删除这条工时记录吗？")) {
      deleteMutation.mutate(id);
    }
  };

  // Get entries for a specific day
  const getEntriesForDay = (date: Date) => {
    return entries.filter((entry) => isSameDay(new Date(entry.work_date), date));
  };

  // Calculate total hours for the current range
  const totalHours = entries.reduce((sum, entry) => sum + Number(entry.hours_worked), 0);

  // Get days in current view
  const daysInView = eachDayOfInterval({ start: dateRange.start, end: dateRange.end });

  return (
    <AppLayout>
      <div className="container mx-auto py-6 space-y-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold text-foreground">工时表</h1>
            <p className="text-muted-foreground">记录和管理工作时间</p>
          </div>
          <Button onClick={handleAddEntry} className="gap-2">
            <Plus className="h-4 w-4" />
            添加工时
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Left sidebar - Calendar and Summary */}
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  locale={zhCN}
                  className="rounded-md"
                />
              </CardContent>
            </Card>

            <TimesheetSummary
              entries={entries}
              totalHours={totalHours}
              viewMode={viewMode}
              dateRange={dateRange}
            />
          </div>

          {/* Main content */}
          <div className="lg:col-span-3">
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <Clock className="h-5 w-5" />
                    {viewMode === "day" && format(selectedDate, "yyyy年MM月dd日 EEEE", { locale: zhCN })}
                    {viewMode === "week" && `${format(dateRange.start, "MM月dd日")} - ${format(dateRange.end, "MM月dd日")}`}
                    {viewMode === "month" && format(selectedDate, "yyyy年MM月", { locale: zhCN })}
                  </CardTitle>
                  <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "day" | "week" | "month")}>
                    <TabsList>
                      <TabsTrigger value="day" className="gap-1">
                        <CalendarIcon className="h-4 w-4" />
                        日
                      </TabsTrigger>
                      <TabsTrigger value="week" className="gap-1">
                        <BarChart3 className="h-4 w-4" />
                        周
                      </TabsTrigger>
                      <TabsTrigger value="month" className="gap-1">
                        <BarChart3 className="h-4 w-4" />
                        月
                      </TabsTrigger>
                    </TabsList>
                  </Tabs>
                </div>
              </CardHeader>
              <CardContent>
                {isLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                  </div>
                ) : viewMode === "day" ? (
                  <TimesheetDayView
                    entries={getEntriesForDay(selectedDate)}
                    teamMembers={teamMembers}
                    onEdit={handleEditEntry}
                    onDelete={handleDeleteEntry}
                    onAdd={handleAddEntry}
                  />
                ) : (
                  <div className="space-y-4">
                    {daysInView.map((day) => {
                      const dayEntries = getEntriesForDay(day);
                      const dayTotal = dayEntries.reduce((sum, e) => sum + Number(e.hours_worked), 0);
                      return (
                        <div
                          key={day.toISOString()}
                          className="border rounded-lg p-3 hover:bg-muted/50 cursor-pointer transition-colors"
                          onClick={() => {
                            setSelectedDate(day);
                            setViewMode("day");
                          }}
                        >
                          <div className="flex items-center justify-between">
                            <div className="font-medium">
                              {format(day, "MM月dd日 EEEE", { locale: zhCN })}
                            </div>
                            <div className="text-sm text-muted-foreground">
                              {dayEntries.length > 0 ? (
                                <span className="text-primary font-medium">{dayTotal.toFixed(1)} 小时</span>
                              ) : (
                                <span>无记录</span>
                              )}
                            </div>
                          </div>
                          {dayEntries.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-2">
                              {dayEntries.slice(0, 3).map((entry) => (
                                <span
                                  key={entry.id}
                                  className="text-xs bg-primary/10 text-primary px-2 py-1 rounded"
                                >
                                  {entry.client_name || "未指定客户"} - {entry.hours_worked}h
                                </span>
                              ))}
                              {dayEntries.length > 3 && (
                                <span className="text-xs text-muted-foreground">
                                  +{dayEntries.length - 3} 更多
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      <TimesheetEntryDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        entry={editingEntry}
        selectedDate={selectedDate}
        teamMembers={teamMembers}
      />
    </AppLayout>
  );
}
