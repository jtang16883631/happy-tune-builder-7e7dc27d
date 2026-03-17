import { useState, useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Loader2, DollarSign, Copy, Check, X, Minus, Maximize2, Minimize2, GripHorizontal } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface CostItem {
  id: string;
  ndc: string | null;
  material_description: string | null;
  unit_price: number | null;
  source: string | null;
  material: string | null;
  billing_date: string | null;
  manufacturer: string | null;
  generic: string | null;
  strength: string | null;
  size: string | null;
  dose: string | null;
  sheet_name: string | null;
}

interface OfflineCostSearchFns {
  searchCostItems: (templateId: string, query: string, sheetName?: string) => Promise<Array<{
    id: string; ndc: string | null; material_description: string | null;
    unit_price: number | null; source: string | null; material: string | null;
    sheet_name: string | null; billing_date: string | null; manufacturer: string | null;
    generic: string | null; strength: string | null; size: string | null; dose: string | null;
  }>>;
  getCostSheetNames: (templateId: string) => string[];
  getCostItemCount: (templateId: string, sheetName?: string) => number;
}

interface CostDataLookupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string | null;
  isOnline?: boolean;
  offlineFns?: OfflineCostSearchFns;
}

interface ColumnDef {
  key: keyof CostItem;
  label: string;
  minWidth: number;
  defaultWidth: number;
}

const ALL_COLUMNS: ColumnDef[] = [
  { key: 'ndc', label: 'NDC', minWidth: 80, defaultWidth: 120 },
  { key: 'material_description', label: 'Product Description', minWidth: 150, defaultWidth: 250 },
  { key: 'unit_price', label: 'Invoice Price', minWidth: 80, defaultWidth: 100 },
  { key: 'source', label: 'Source', minWidth: 60, defaultWidth: 100 },
  { key: 'sheet_name', label: 'Sheet', minWidth: 90, defaultWidth: 120 },
  { key: 'manufacturer', label: 'Manufacturer', minWidth: 100, defaultWidth: 150 },
  { key: 'material', label: 'ABC 6', minWidth: 60, defaultWidth: 80 },
  { key: 'billing_date', label: 'Invoice Date', minWidth: 80, defaultWidth: 100 },
  { key: 'generic', label: 'Generic', minWidth: 100, defaultWidth: 150 },
  { key: 'strength', label: 'Strength', minWidth: 60, defaultWidth: 80 },
  { key: 'size', label: 'Size', minWidth: 50, defaultWidth: 60 },
  { key: 'dose', label: 'Dose', minWidth: 50, defaultWidth: 60 },
];

const MIN_WIDTH = 400;
const MIN_HEIGHT = 300;

export function CostDataLookupDialog({
  open,
  onOpenChange,
  templateId,
  isOnline = true,
  offlineFns,
}: CostDataLookupDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [filteredItems, setFilteredItems] = useState<CostItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [hasSearched, setHasSearched] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [windowPos, setWindowPos] = useState({ x: 0, y: 0 });
  const [windowSize, setWindowSize] = useState({ w: 0, h: 0 });
  const [preMaxState, setPreMaxState] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [columnWidths, setColumnWidths] = useState<Record<string, number>>(() => {
    const initial: Record<string, number> = {};
    ALL_COLUMNS.forEach((col) => {
      initial[col.key] = col.defaultWidth;
    });
    return initial;
  });

  const useOfflineMode = !isOnline && !!offlineFns;
  const colResizingRef = useRef<{ key: string; startX: number; startWidth: number } | null>(null);
  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(null);
  const resizeRef = useRef<{ startX: number; startY: number; origW: number; origH: number } | null>(null);
  const windowRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = Math.min(Math.max(vw * 0.55, MIN_WIDTH), vw - 40);
    const h = Math.min(Math.max(vh * 0.7, MIN_HEIGHT), vh - 40);
    setWindowSize({ w, h });
    setWindowPos({ x: vw - w - 20, y: 20 });
    setIsMinimized(false);
    setIsMaximized(false);
    setPreMaxState(null);
  }, [open]);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (isMaximized) return;
    e.preventDefault();
    dragRef.current = { startX: e.clientX, startY: e.clientY, origX: windowPos.x, origY: windowPos.y };

    const onMove = (ev: MouseEvent) => {
      if (!dragRef.current) return;
      const dx = ev.clientX - dragRef.current.startX;
      const dy = ev.clientY - dragRef.current.startY;
      setWindowPos({
        x: Math.max(0, Math.min(window.innerWidth - 100, dragRef.current.origX + dx)),
        y: Math.max(0, Math.min(window.innerHeight - 40, dragRef.current.origY + dy)),
      });
    };

    const onUp = () => {
      dragRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [isMaximized, windowPos]);

  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    if (isMaximized) return;
    e.preventDefault();
    e.stopPropagation();
    resizeRef.current = { startX: e.clientX, startY: e.clientY, origW: windowSize.w, origH: windowSize.h };

    const onMove = (ev: MouseEvent) => {
      if (!resizeRef.current) return;
      const dw = ev.clientX - resizeRef.current.startX;
      const dh = ev.clientY - resizeRef.current.startY;
      setWindowSize({
        w: Math.max(MIN_WIDTH, resizeRef.current.origW + dw),
        h: Math.max(MIN_HEIGHT, resizeRef.current.origH + dh),
      });
    };

    const onUp = () => {
      resizeRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [isMaximized, windowSize]);

  const toggleMaximize = () => {
    if (isMaximized) {
      if (preMaxState) {
        setWindowPos({ x: preMaxState.x, y: preMaxState.y });
        setWindowSize({ w: preMaxState.w, h: preMaxState.h });
      }
      setIsMaximized(false);
      return;
    }

    setPreMaxState({ ...windowPos, ...windowSize });
    setWindowPos({ x: 0, y: 0 });
    setWindowSize({ w: window.innerWidth, h: window.innerHeight });
    setIsMaximized(true);
  };

  const loadSheetTabs = useCallback(async () => {
    if (!templateId) return;
    setIsLoading(true);

    try {
      if (useOfflineMode && offlineFns) {
        const sheets = offlineFns.getCostSheetNames(templateId);
        setTotalCount(offlineFns.getCostItemCount(templateId));
        setSheetNames(sheets);
        setSelectedSheet(sheets[0] || '');
        return;
      }

      const { count: totalItems } = await supabase
        .from('template_cost_items')
        .select('*', { count: 'exact', head: true })
        .eq('template_id', templateId);
      setTotalCount(totalItems || 0);

      const sheetSet = new Set<string>();
      let lastSheet: string | null = null;
      for (let i = 0; i < 50; i++) {
        let q = supabase
          .from('template_cost_items')
          .select('sheet_name')
          .eq('template_id', templateId)
          .not('sheet_name', 'is', null)
          .neq('sheet_name', '')
          .order('sheet_name')
          .limit(1);
        if (lastSheet) q = q.gt('sheet_name', lastSheet);
        const { data } = await q;
        const next = (data?.[0]?.sheet_name ?? '').trim();
        if (!next) break;
        sheetSet.add(next);
        lastSheet = next;
      }

      const uniqueSheets = Array.from(sheetSet).sort((a, b) => a.localeCompare(b));
      setSheetNames(uniqueSheets);
      setSelectedSheet(uniqueSheets[0] || '');
    } catch (err) {
      console.error('Error loading sheet tabs:', err);
    } finally {
      setIsLoading(false);
    }
  }, [templateId, useOfflineMode, offlineFns]);

  useEffect(() => {
    if (!open || !templateId) return;
    loadSheetTabs();
    setSearchQuery('');
    setFilteredItems([]);
    setHasSearched(false);
  }, [open, templateId, loadSheetTabs]);

  const handleSheetChange = (sheet: string) => {
    setSelectedSheet(sheet);
    setSearchQuery('');
    setFilteredItems([]);
    setHasSearched(false);
  };

  const handleDatabaseSearch = async () => {
    if (!templateId || !searchQuery.trim()) return;
    setIsLoading(true);
    setHasSearched(true);

    try {
      if (useOfflineMode && offlineFns) {
        const results = await offlineFns.searchCostItems(templateId, searchQuery, selectedSheet || undefined);
        setFilteredItems(results.map((item) => ({
          id: item.id,
          ndc: item.ndc,
          material_description: item.material_description,
          unit_price: item.unit_price,
          source: item.source,
          material: item.material,
          billing_date: item.billing_date,
          manufacturer: item.manufacturer,
          generic: item.generic,
          strength: item.strength,
          size: item.size,
          dose: item.dose,
          sheet_name: item.sheet_name,
        })));
        return;
      }

      const query = `%${searchQuery}%`;
      let dbQuery = supabase
        .from('template_cost_items')
        .select('id, ndc, material_description, unit_price, source, material, billing_date, manufacturer, generic, strength, size, dose, sheet_name')
        .eq('template_id', templateId)
        .or([
          `ndc.ilike.${query}`,
          `material_description.ilike.${query}`,
          `manufacturer.ilike.${query}`,
          `generic.ilike.${query}`,
          `strength.ilike.${query}`,
          `size.ilike.${query}`,
          `dose.ilike.${query}`,
          `source.ilike.${query}`,
          `material.ilike.${query}`,
          `billing_date.ilike.${query}`,
          `sheet_name.ilike.${query}`,
        ].join(','))
        .order('source', { ascending: true, nullsFirst: false })
        .limit(500);

      if (selectedSheet) dbQuery = dbQuery.eq('sheet_name', selectedSheet);
      const { data, error } = await dbQuery;
      if (error) throw error;
      setFilteredItems(data || []);
    } catch (err) {
      console.error('Error searching cost items:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatPrice = (price: number | null) => {
    if (price === null || price === undefined) return '-';
    return `$${price.toFixed(2)}`;
  };

  const formatCellValue = (item: CostItem, key: keyof CostItem) => {
    const value = item[key];
    if (value === null || value === undefined) return '-';
    if (key === 'unit_price') return formatPrice(value as number);
    return String(value);
  };

  const handleCopyAll = async () => {
    const header = ALL_COLUMNS.map((col) => col.label).join('\t');
    const rows = filteredItems.map((item) =>
      ALL_COLUMNS.map((col) => {
        const value = item[col.key];
        if (value === null || value === undefined) return '';
        if (col.key === 'unit_price') return formatPrice(value as number);
        return String(value);
      }).join('\t')
    );

    try {
      await navigator.clipboard.writeText([header, ...rows].join('\n'));
      setIsCopied(true);
      toast.success(`Copied ${filteredItems.length + 1} rows to clipboard`);
      setTimeout(() => setIsCopied(false), 2000);
    } catch {
      toast.error('Failed to copy to clipboard');
    }
  };

  const handleColResizeStart = (key: string, e: React.MouseEvent) => {
    e.preventDefault();
    colResizingRef.current = { key, startX: e.clientX, startWidth: columnWidths[key] };

    const onMove = (ev: MouseEvent) => {
      if (!colResizingRef.current) return;
      const { key: activeKey, startX, startWidth } = colResizingRef.current;
      const colDef = ALL_COLUMNS.find((col) => col.key === activeKey);
      const nextWidth = startWidth + (ev.clientX - startX);
      setColumnWidths((prev) => ({
        ...prev,
        [activeKey]: Math.max(colDef?.minWidth || 50, nextWidth),
      }));
    };

    const onUp = () => {
      colResizingRef.current = null;
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  if (!open) return null;

  const posStyle = isMaximized
    ? { left: 0, top: 0, width: '100vw', height: '100vh' }
    : isMinimized
      ? { left: windowPos.x, top: windowPos.y, width: windowSize.w, height: 'auto' }
      : { left: windowPos.x, top: windowPos.y, width: windowSize.w, height: windowSize.h };

  return createPortal(
    <div
      ref={windowRef}
      className="fixed z-50 flex flex-col overflow-hidden rounded-lg border border-border bg-background shadow-2xl"
      style={posStyle}
    >
      <div
        className="flex shrink-0 cursor-grab select-none items-center justify-between border-b bg-muted/80 px-3 py-2 active:cursor-grabbing"
        onMouseDown={handleDragStart}
        onDoubleClick={toggleMaximize}
      >
        <div className="flex items-center gap-2 truncate text-sm font-semibold">
          <GripHorizontal className="h-4 w-4 shrink-0 text-muted-foreground" />
          <DollarSign className="h-4 w-4 shrink-0" />
          <span className="truncate">Cost Data Lookup</span>
          {useOfflineMode && (
            <span className="rounded bg-yellow-100 px-1.5 py-0.5 text-[10px] font-normal text-yellow-600 dark:bg-yellow-900/30 dark:text-yellow-400">
              Offline
            </span>
          )}
          <span className="text-xs font-normal text-muted-foreground">({totalCount.toLocaleString()} items)</span>
        </div>
        <div className="flex shrink-0 items-center gap-1" onMouseDown={(e) => e.stopPropagation()}>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title={isMinimized ? 'Expand' : 'Minimize'}
          >
            {isMinimized ? <Maximize2 className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={toggleMaximize}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            title={isMaximized ? 'Restore' : 'Maximize'}
          >
            {isMaximized ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          </button>
          <button
            onClick={() => onOpenChange(false)}
            className="rounded p-1 text-muted-foreground transition-colors hover:bg-destructive/20 hover:text-destructive"
            title="Close"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <div className="flex flex-1 flex-col gap-2 overflow-hidden p-3 pb-5">
          {sheetNames.length > 0 && (
            <div className="flex shrink-0 items-center gap-1 border-b">
              <div className="flex gap-0 overflow-x-auto">
                {sheetNames.map((sheet) => (
                  <button
                    key={sheet}
                    onClick={() => handleSheetChange(sheet)}
                    className={`border-b-2 px-3 py-1.5 text-xs font-medium whitespace-nowrap transition-colors ${
                      selectedSheet === sheet
                        ? 'border-primary bg-primary/10 text-primary'
                        : 'border-transparent text-muted-foreground hover:bg-muted/50 hover:text-foreground'
                    }`}
                  >
                    {sheet}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="flex shrink-0 gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search NDC, description, sheet, manufacturer, generic, strength, size, dose..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleDatabaseSearch()}
                className="h-8 pl-8 text-sm"
                autoFocus
              />
            </div>
            <Button onClick={handleDatabaseSearch} disabled={isLoading || !searchQuery.trim()} variant="outline" size="sm">
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
            </Button>
            <Button
              onClick={handleCopyAll}
              disabled={isLoading || filteredItems.length === 0}
              variant="outline"
              size="sm"
              title="Copy all data to clipboard"
            >
              {isCopied ? (
                <>
                  <Check className="mr-1 h-3.5 w-3.5 text-primary" />Copied
                </>
              ) : (
                <>
                  <Copy className="mr-1 h-3.5 w-3.5" />Copy
                </>
              )}
            </Button>
          </div>

          {hasSearched && (
            <div className="shrink-0 text-xs text-muted-foreground">
              {filteredItems.length.toLocaleString()} results
              {selectedSheet && ` in "${selectedSheet}"`}
              {filteredItems.length > 0 && ' · sorted by Source A–Z'}
            </div>
          )}

          <ScrollArea className="flex-1 rounded-md border">
            <div className="min-w-max">
              <table className="w-full border-collapse">
                <thead className="sticky top-0 z-10">
                  <tr className="bg-muted/80 backdrop-blur-sm">
                    {ALL_COLUMNS.map((col) => (
                      <th
                        key={col.key}
                        className="relative border-b px-2 py-1.5 text-left text-xs font-medium select-none text-muted-foreground"
                        style={{ width: columnWidths[col.key], minWidth: col.minWidth }}
                      >
                        <span className="block truncate">{col.label}</span>
                        <div
                          className="absolute bottom-0 right-0 top-0 w-1 cursor-col-resize hover:bg-primary/50 active:bg-primary"
                          onMouseDown={(e) => handleColResizeStart(col.key, e)}
                        />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {isLoading ? (
                    <tr>
                      <td colSpan={ALL_COLUMNS.length} className="py-8 text-center">
                        <Loader2 className="mx-auto h-6 w-6 animate-spin" />
                      </td>
                    </tr>
                  ) : filteredItems.length === 0 ? (
                    <tr>
                      <td colSpan={ALL_COLUMNS.length} className="py-8 text-center text-muted-foreground">
                        {!hasSearched ? (
                          <div className="flex flex-col items-center gap-1">
                            <Search className="h-6 w-6 opacity-30" />
                            <span className="text-xs">Search to find cost items</span>
                          </div>
                        ) : 'No matching items found'}
                      </td>
                    </tr>
                  ) : (
                    filteredItems.map((item) => (
                      <tr key={item.id} className="border-b border-muted/20 hover:bg-muted/30">
                        {ALL_COLUMNS.map((col) => (
                          <td
                            key={col.key}
                            className="truncate px-2 py-1 text-xs"
                            style={{ width: columnWidths[col.key], maxWidth: columnWidths[col.key], minWidth: col.minWidth }}
                            title={formatCellValue(item, col.key)}
                          >
                            <span className={col.key === 'ndc' || col.key === 'unit_price' ? 'font-mono' : ''}>
                              {formatCellValue(item, col.key)}
                            </span>
                          </td>
                        ))}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </ScrollArea>
        </div>
      )}

      {!isMinimized && !isMaximized && (
        <div
          className="absolute bottom-0 right-0 z-20 flex h-6 w-6 cursor-nwse-resize items-end justify-end rounded-tl-md bg-background/80 pb-0.5 pr-0.5 backdrop-blur-sm"
          onMouseDown={handleResizeStart}
          title="Resize window"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" className="text-muted-foreground/50">
            <path d="M14 14L8 14L14 8Z" fill="currentColor" />
            <path d="M14 14L11 14L14 11Z" fill="currentColor" opacity="0.5" />
          </svg>
        </div>
      )}
    </div>,
    document.body,
  );
}
