import { useState, useEffect, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Loader2, DollarSign } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';

interface CostItem {
  id: string;
  ndc: string | null;
  generic: string | null;
  material_description: string | null;
  strength: string | null;
  size: string | null;
  manufacturer: string | null;
  unit_price: number | null;
  sheet_name: string | null;
}

interface CostDataLookupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templateId: string | null;
}

export function CostDataLookupDialog({
  open,
  onOpenChange,
  templateId,
}: CostDataLookupDialogProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [costItems, setCostItems] = useState<CostItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<CostItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [totalCount, setTotalCount] = useState(0);

  // Load cost items when dialog opens
  const loadCostItems = useCallback(async () => {
    if (!templateId) return;
    
    setIsLoading(true);
    try {
      // Get count first
      const { count } = await supabase
        .from('template_cost_items')
        .select('*', { count: 'exact', head: true })
        .eq('template_id', templateId);
      
      setTotalCount(count || 0);

      // Load items (limit for performance)
      const { data, error } = await supabase
        .from('template_cost_items')
        .select('id, ndc, generic, material_description, strength, size, manufacturer, unit_price, sheet_name')
        .eq('template_id', templateId)
        .order('ndc')
        .limit(500);

      if (error) throw error;
      setCostItems(data || []);
      setFilteredItems(data || []);
    } catch (err) {
      console.error('Error loading cost items:', err);
    } finally {
      setIsLoading(false);
    }
  }, [templateId]);

  useEffect(() => {
    if (open && templateId) {
      loadCostItems();
      setSearchQuery('');
    }
  }, [open, templateId, loadCostItems]);

  // Filter items based on search query
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredItems(costItems);
      return;
    }

    const query = searchQuery.toLowerCase();
    const filtered = costItems.filter(item => 
      (item.ndc && item.ndc.toLowerCase().includes(query)) ||
      (item.generic && item.generic.toLowerCase().includes(query)) ||
      (item.material_description && item.material_description.toLowerCase().includes(query)) ||
      (item.manufacturer && item.manufacturer.toLowerCase().includes(query))
    );
    setFilteredItems(filtered);
  }, [searchQuery, costItems]);

  // Search in database for more results
  const handleDatabaseSearch = async () => {
    if (!templateId || !searchQuery.trim()) return;
    
    setIsLoading(true);
    try {
      const query = `%${searchQuery}%`;
      const { data, error } = await supabase
        .from('template_cost_items')
        .select('id, ndc, generic, material_description, strength, size, manufacturer, unit_price, sheet_name')
        .eq('template_id', templateId)
        .or(`ndc.ilike.${query},generic.ilike.${query},material_description.ilike.${query}`)
        .limit(100);

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
    return `$${price.toFixed(4)}`;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Cost Data Lookup
            <span className="text-sm font-normal text-muted-foreground">
              ({totalCount.toLocaleString()} items)
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Search bar */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by NDC, Generic, Description, Manufacturer..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleDatabaseSearch()}
                className="pl-8"
                autoFocus
              />
            </div>
            <Button onClick={handleDatabaseSearch} disabled={isLoading}>
              {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search DB'}
            </Button>
          </div>

          {/* Results count */}
          <div className="text-sm text-muted-foreground">
            Showing {filteredItems.length} of {totalCount.toLocaleString()} items
            {searchQuery && ` matching "${searchQuery}"`}
          </div>

          {/* Results table */}
          <ScrollArea className="h-[50vh] rounded-md border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  <TableHead className="w-32">NDC</TableHead>
                  <TableHead className="w-48">Generic</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead className="w-24">Strength</TableHead>
                  <TableHead className="w-20">Size</TableHead>
                  <TableHead className="w-32">Manufacturer</TableHead>
                  <TableHead className="w-24 text-right">Unit Price</TableHead>
                  <TableHead className="w-20">Sheet</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8">
                      <Loader2 className="h-6 w-6 animate-spin mx-auto" />
                    </TableCell>
                  </TableRow>
                ) : filteredItems.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                      {searchQuery ? 'No matching cost items found' : 'No cost data available'}
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredItems.map((item) => (
                    <TableRow key={item.id} className="hover:bg-muted/30">
                      <TableCell className="font-mono text-xs">{item.ndc || '-'}</TableCell>
                      <TableCell className="text-xs">{item.generic || '-'}</TableCell>
                      <TableCell className="text-xs max-w-[200px] truncate" title={item.material_description || ''}>
                        {item.material_description || '-'}
                      </TableCell>
                      <TableCell className="text-xs">{item.strength || '-'}</TableCell>
                      <TableCell className="text-xs">{item.size || '-'}</TableCell>
                      <TableCell className="text-xs">{item.manufacturer || '-'}</TableCell>
                      <TableCell className="text-right font-mono text-xs font-medium">
                        {formatPrice(item.unit_price)}
                      </TableCell>
                      <TableCell className="text-xs">{item.sheet_name || '-'}</TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </ScrollArea>
        </div>
      </DialogContent>
    </Dialog>
  );
}
