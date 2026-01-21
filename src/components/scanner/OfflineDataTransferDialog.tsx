import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Download, Upload, CheckCircle, AlertTriangle, Loader2, HardDrive } from 'lucide-react';
import { useOfflineTemplates, OfflineTemplate, OfflineSection, OfflineCostItem } from '@/hooks/useOfflineTemplates';
import { useLocalFDA, FDADrug } from '@/hooks/useLocalFDA';
import { toast } from '@/hooks/use-toast';

interface OfflineDataPackage {
  version: string;
  exportedAt: string;
  exportedBy: string;
  templates: OfflineTemplate[];
  sections: { templateId: string; items: OfflineSection[] }[];
  costItems: { templateId: string; items: OfflineCostItem[] }[];
  fdaDrugs: FDADrug[];
  fdaMeta: any;
}

interface OfflineDataTransferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function OfflineDataTransferDialog({ open, onOpenChange }: OfflineDataTransferDialogProps) {
  const [mode, setMode] = useState<'menu' | 'export' | 'import'>('menu');
  const [isProcessing, setIsProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { templates, getSections, syncMeta, isReady: templatesReady } = useOfflineTemplates();
  const { meta: fdaMeta, isReady: fdaReady, searchDrugs } = useLocalFDA();

  const handleExport = async () => {
    setMode('export');
    setIsProcessing(true);
    setProgress(0);
    setStatus('Gathering templates...');

    try {
      setProgress(10);
      setStatus(`Found ${templates.length} templates`);

      // Get all sections for all templates
      const allSections: { templateId: string; items: OfflineSection[] }[] = [];
      const allCostItems: { templateId: string; items: OfflineCostItem[] }[] = [];

      for (let i = 0; i < templates.length; i++) {
        const template = templates[i];
        setStatus(`Processing template ${i + 1}/${templates.length}: ${template.name}`);
        setProgress(10 + (i / templates.length) * 40);

        const sections = await getSections(template.id);
        allSections.push({ templateId: template.id, items: sections });
        
        // Note: Cost items are fetched during sync, we'll export what's in the db
        // For now we export sections - cost items would need a separate method
      }

      setProgress(50);
      setStatus('Gathering FDA data...');

      // Get FDA drugs (search all)
      let fdaDrugs: FDADrug[] = [];
      if (fdaReady && fdaMeta) {
        // Search with empty string returns first 100, we need all
        // For export, we'll note the limitation
        fdaDrugs = searchDrugs('', 50000); // Get up to 50k
      }
      setProgress(80);

      // Create package
      const dataPackage: OfflineDataPackage = {
        version: '1.0',
        exportedAt: new Date().toISOString(),
        exportedBy: 'Meridian Portal',
        templates: templates,
        sections: allSections,
        costItems: allCostItems,
        fdaDrugs: fdaDrugs,
        fdaMeta: fdaMeta,
      };

      setProgress(90);
      setStatus('Creating download file...');

      // Create and download file
      const blob = new Blob([JSON.stringify(dataPackage)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `meridian-offline-data-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      setProgress(100);
      setStatus('Export complete!');

      const sectionCount = allSections.reduce((acc, s) => acc + s.items.length, 0);

      toast({
        title: 'Export successful!',
        description: `Exported ${templates.length} templates, ${sectionCount} sections, and ${fdaDrugs.length} FDA drugs`,
      });

      setTimeout(() => {
        setMode('menu');
        setIsProcessing(false);
      }, 1500);

    } catch (error: any) {
      console.error('Export error:', error);
      toast({
        title: 'Export failed',
        description: error.message,
        variant: 'destructive',
      });
      setIsProcessing(false);
      setMode('menu');
    }
  };

  const handleImport = async (file: File) => {
    setMode('import');
    setIsProcessing(true);
    setProgress(0);
    setStatus('Reading file...');

    try {
      const text = await file.text();
      const dataPackage: OfflineDataPackage = JSON.parse(text);

      if (!dataPackage.version || !dataPackage.templates) {
        throw new Error('Invalid data package format');
      }

      setProgress(10);
      setStatus('Validating data...');

      const templateCount = dataPackage.templates?.length || 0;
      const sectionCount = dataPackage.sections?.reduce((acc, s) => acc + s.items.length, 0) || 0;
      const fdaCount = dataPackage.fdaDrugs?.length || 0;

      setProgress(30);
      setStatus(`Found ${templateCount} templates, ${sectionCount} sections, ${fdaCount} FDA drugs`);

      // Store data in IndexedDB for later use
      // This is a simplified import - for full functionality, we'd need to
      // recreate the SQLite database from the package data
      
      // For now, store the package in localStorage as a backup
      try {
        localStorage.setItem('meridian_import_package', JSON.stringify({
          importedAt: new Date().toISOString(),
          templateCount,
          sectionCount,
          fdaCount,
        }));
      } catch (e) {
        // Storage might be full, continue anyway
      }

      setProgress(100);
      setStatus('Import ready - please sync templates normally');

      toast({
        title: 'Data package loaded',
        description: `Package contains ${templateCount} templates and ${fdaCount} FDA drugs. Use the Sync feature to import template data.`,
      });

      setTimeout(() => {
        setMode('menu');
        setIsProcessing(false);
      }, 2000);

    } catch (error: any) {
      console.error('Import error:', error);
      toast({
        title: 'Import failed',
        description: error.message,
        variant: 'destructive',
      });
      setIsProcessing(false);
      setMode('menu');
    }
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      handleImport(file);
    }
    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const resetDialog = () => {
    setMode('menu');
    setIsProcessing(false);
    setProgress(0);
    setStatus('');
  };

  const hasData = templates.length > 0 || (fdaMeta && fdaMeta.rowCount > 0);

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) resetDialog();
      onOpenChange(isOpen);
    }}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <HardDrive className="h-5 w-5" />
            Offline Data Transfer
          </DialogTitle>
          <DialogDescription>
            Export data to a flash drive or import from another device
          </DialogDescription>
        </DialogHeader>

        {mode === 'menu' && (
          <div className="space-y-4 py-4">
            {/* Current Data Stats */}
            <div className="rounded-lg bg-muted p-4 space-y-2">
              <h4 className="font-medium text-sm">Current Offline Data</h4>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{templates.length}</Badge>
                  <span className="text-muted-foreground">Templates</span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{fdaMeta?.rowCount || 0}</Badge>
                  <span className="text-muted-foreground">FDA Drugs</span>
                </div>
              </div>
              {syncMeta?.lastSyncedAt && (
                <p className="text-xs text-muted-foreground">
                  Last synced: {new Date(syncMeta.lastSyncedAt).toLocaleDateString()}
                </p>
              )}
            </div>

            {/* Export Button */}
            <Button
              variant="outline"
              className="w-full justify-start gap-3 h-auto py-4"
              onClick={handleExport}
              disabled={!hasData}
            >
              <Download className="h-5 w-5 text-primary" />
              <div className="text-left">
                <div className="font-medium">Export to File</div>
                <div className="text-xs text-muted-foreground">
                  Save data to flash drive for transfer
                </div>
              </div>
            </Button>

            {/* Import Button */}
            <div className="relative">
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={handleFileSelect}
                className="absolute inset-0 opacity-0 cursor-pointer"
              />
              <Button
                variant="outline"
                className="w-full justify-start gap-3 h-auto py-4"
              >
                <Upload className="h-5 w-5 text-primary" />
                <div className="text-left">
                  <div className="font-medium">Import from File</div>
                  <div className="text-xs text-muted-foreground">
                    Load data from another device
                  </div>
                </div>
              </Button>
            </div>

            {/* Info */}
            <div className="flex items-start gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs">
              <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5 text-amber-600" />
              <div className="text-amber-800 dark:text-amber-200">
                <p className="font-medium">Note about importing</p>
                <p>For full offline functionality, use the normal Sync feature while online. Export is for backup and reference.</p>
              </div>
            </div>
          </div>
        )}

        {(mode === 'export' || mode === 'import') && (
          <div className="py-6 space-y-4">
            <div className="flex items-center justify-center">
              {progress < 100 ? (
                <Loader2 className="h-12 w-12 animate-spin text-primary" />
              ) : (
                <CheckCircle className="h-12 w-12 text-green-600" />
              )}
            </div>

            <div className="text-center">
              <h4 className="font-medium mb-1">
                {mode === 'export' ? 'Exporting Data' : 'Importing Data'}
              </h4>
              <p className="text-sm text-muted-foreground">{status}</p>
            </div>

            <Progress value={progress} className="h-2" />
            <p className="text-center text-sm text-muted-foreground">{Math.round(progress)}%</p>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}