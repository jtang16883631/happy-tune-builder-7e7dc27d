import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Package, Pill, AlertCircle } from 'lucide-react';
import { useState } from 'react';
import { ScrollArea } from '@/components/ui/scroll-area';

export interface OuterNDCOption {
  outerNDC: string;
  trade: string | null;
  generic: string | null;
  strength: string | null;
  packageSize: string | null;
  manufacturer: string | null;
  doseForm: string | null;
}

interface OuterNDCSelectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scannedNDC: string;
  options: OuterNDCOption[];
  onSelect: (outerNDC: string) => void;
  onCancel: () => void;
}

export function OuterNDCSelectionDialog({
  open,
  onOpenChange,
  scannedNDC,
  options,
  onSelect,
  onCancel,
}: OuterNDCSelectionDialogProps) {
  const [selectedNDC, setSelectedNDC] = useState<string | null>(null);

  const handleConfirm = () => {
    if (selectedNDC) {
      onSelect(selectedNDC);
      setSelectedNDC(null);
    }
  };

  const handleCancel = () => {
    setSelectedNDC(null);
    onCancel();
  };

  // Format NDC with dashes: 5-4-2 format
  const formatNDC = (ndc: string): string => {
    if (!ndc) return '';
    const clean = ndc.replace(/-/g, '');
    if (clean.length === 11) {
      return `${clean.slice(0, 5)}-${clean.slice(5, 9)}-${clean.slice(9)}`;
    }
    return ndc;
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-lg">Inner NDC Found – Choose an Outer NDC</DialogTitle>
              <DialogDescription className="text-sm">
                Multiple outer pack options detected for this inner NDC
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="mt-2 rounded-lg bg-muted/50 p-3">
          <div className="flex items-center gap-2 text-sm">
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">Scanned Inner NDC:</span>
            <Badge variant="outline" className="font-mono">
              {formatNDC(scannedNDC)}
            </Badge>
          </div>
        </div>

        <ScrollArea className="max-h-[400px] pr-4">
          <RadioGroup
            value={selectedNDC || ''}
            onValueChange={setSelectedNDC}
            className="space-y-3 mt-4"
          >
            {options.map((option, index) => (
              <div key={option.outerNDC + index}>
                <Label
                  htmlFor={`ndc-${index}`}
                  className={`flex cursor-pointer rounded-lg border-2 p-4 transition-all hover:bg-muted/50 ${
                    selectedNDC === option.outerNDC
                      ? 'border-primary bg-primary/5'
                      : 'border-border'
                  }`}
                >
                  <RadioGroupItem
                    value={option.outerNDC}
                    id={`ndc-${index}`}
                    className="mt-1 mr-3"
                  />
                  <div className="flex-1 space-y-2">
                    {/* Outer NDC */}
                    <div className="flex items-center gap-2">
                      <Badge className="font-mono text-sm" variant="secondary">
                        {formatNDC(option.outerNDC)}
                      </Badge>
                      <span className="text-xs text-muted-foreground">Outer Pack NDC</span>
                    </div>

                    {/* Drug Name */}
                    <div className="flex items-start gap-2">
                      <Pill className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                      <div>
                        {option.trade && (
                          <p className="font-medium text-foreground">{option.trade}</p>
                        )}
                        {option.generic && (
                          <p className="text-sm text-muted-foreground">{option.generic}</p>
                        )}
                        {!option.trade && !option.generic && (
                          <p className="text-sm text-muted-foreground italic">No drug name available</p>
                        )}
                      </div>
                    </div>

                    {/* Details */}
                    <div className="flex flex-wrap gap-2 text-xs">
                      {option.strength && (
                        <Badge variant="outline" className="text-xs">
                          {option.strength}
                        </Badge>
                      )}
                      {option.packageSize && (
                        <Badge variant="outline" className="text-xs">
                          {option.packageSize}
                        </Badge>
                      )}
                      {option.doseForm && (
                        <Badge variant="outline" className="text-xs">
                          {option.doseForm}
                        </Badge>
                      )}
                      {option.manufacturer && (
                        <span className="text-muted-foreground">
                          by {option.manufacturer}
                        </span>
                      )}
                    </div>
                  </div>
                </Label>
              </div>
            ))}
          </RadioGroup>
        </ScrollArea>

        <div className="flex justify-end gap-3 mt-4 pt-4 border-t">
          <Button variant="outline" onClick={handleCancel}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedNDC}>
            Use Selected NDC
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
