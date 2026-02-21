import { Search, RefreshCw, Home, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BreadcrumbItem } from "./types";

interface OneDriveToolbarProps {
  breadcrumbs: BreadcrumbItem[];
  searchQuery: string;
  viewMode: "grid" | "list";
  isLoadingFiles: boolean;
  onBreadcrumbClick: (index: number) => void;
  onSearchChange: (query: string) => void;
  onViewModeChange: (mode: "grid" | "list") => void;
  onRefresh: () => void;
}

export function OneDriveToolbar({
  breadcrumbs,
  searchQuery,
  viewMode,
  isLoadingFiles,
  onBreadcrumbClick,
  onSearchChange,
  onViewModeChange,
  onRefresh,
}: OneDriveToolbarProps) {
  return (
    <div className="border-b bg-background">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-1 px-4 py-2 overflow-x-auto">
        {breadcrumbs.map((crumb, index) => (
          <div key={crumb.id || 'root'} className="flex items-center">
            {index > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground mx-1" />}
            <button
              onClick={() => onBreadcrumbClick(index)}
              className={`flex items-center gap-1 px-2 py-1 rounded hover:bg-accent transition-colors text-sm ${
                index === breadcrumbs.length - 1 
                  ? 'font-semibold text-foreground' 
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {index === 0 && <Home className="h-4 w-4" />}
              <span>{crumb.name}</span>
            </button>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="flex items-center justify-between px-4 py-2 gap-4 border-t">
        <div className="flex items-center gap-2">
          <Button 
            variant="ghost" 
            size="icon"
            onClick={onRefresh}
            disabled={isLoadingFiles}
            className="h-8 w-8"
          >
            <RefreshCw className={`h-4 w-4 ${isLoadingFiles ? 'animate-spin' : ''}`} />
          </Button>
        </div>

        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search in OneDrive"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-9 h-9 bg-muted border-0 focus-visible:ring-1"
          />
        </div>
      </div>
    </div>
  );
}
