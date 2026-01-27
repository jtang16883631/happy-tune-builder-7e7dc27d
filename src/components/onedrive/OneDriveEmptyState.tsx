import { Folder, Search, Loader2 } from "lucide-react";

interface OneDriveEmptyStateProps {
  isLoading: boolean;
  hasSearchQuery: boolean;
}

export function OneDriveEmptyState({ isLoading, hasSearchQuery }: OneDriveEmptyStateProps) {
  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <Loader2 className="h-12 w-12 animate-spin text-muted-foreground mb-4" />
        <p className="text-muted-foreground">Loading files...</p>
      </div>
    );
  }

  if (hasSearchQuery) {
    return (
      <div className="flex flex-col items-center justify-center py-20">
        <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
          <Search className="h-8 w-8 text-muted-foreground" />
        </div>
        <h3 className="text-lg font-medium mb-1">No results found</h3>
        <p className="text-muted-foreground text-sm">
          Try searching for something else
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mb-4">
        <Folder className="h-8 w-8 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-medium mb-1">This folder is empty</h3>
      <p className="text-muted-foreground text-sm">
        Upload files to OneDrive to see them here
      </p>
    </div>
  );
}
