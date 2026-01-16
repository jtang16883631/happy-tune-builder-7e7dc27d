import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { Search, Plus, Upload, Download, RefreshCw, Trash2, Edit, Database } from 'lucide-react';
import { AppLayout } from '@/components/layout/AppLayout';

interface Drug {
  id: string;
  ndc: string;
  drug_name: string;
  manufacturer: string | null;
  package_description: string | null;
  unit_cost: number | null;
  fda_status: string | null;
  dea_schedule: string | null;
  source: string;
  updated_at: string;
}

const DrugDatabase = () => {
  const { session } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [fdaSearchTerm, setFdaSearchTerm] = useState('');
  const [ndcLookup, setNdcLookup] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isFdaDialogOpen, setIsFdaDialogOpen] = useState(false);
  const [editingDrug, setEditingDrug] = useState<Drug | null>(null);
  const [fdaResults, setFdaResults] = useState<any[]>([]);
  const [isSearchingFda, setIsSearchingFda] = useState(false);
  
  const [newDrug, setNewDrug] = useState({
    ndc: '',
    drug_name: '',
    manufacturer: '',
    package_description: '',
    unit_cost: '',
  });

  // Fetch drugs from database
  const { data: drugs = [], isLoading } = useQuery({
    queryKey: ['drugs', searchTerm],
    queryFn: async () => {
      let query = supabase
        .from('drugs')
        .select('*')
        .order('drug_name');
      
      if (searchTerm) {
        query = query.or(`drug_name.ilike.%${searchTerm}%,ndc.ilike.%${searchTerm}%,manufacturer.ilike.%${searchTerm}%`);
      }
      
      const { data, error } = await query;
      if (error) throw error;
      return data as Drug[];
    },
  });

  // Add/Update drug mutation
  const saveDrugMutation = useMutation({
    mutationFn: async (drug: { ndc: string; drug_name: string; manufacturer: string; package_description: string; unit_cost: string }) => {
      if (editingDrug) {
        const { error } = await supabase
          .from('drugs')
          .update({
            ndc: drug.ndc,
            drug_name: drug.drug_name,
            manufacturer: drug.manufacturer || null,
            package_description: drug.package_description || null,
            unit_cost: drug.unit_cost ? parseFloat(drug.unit_cost as unknown as string) : null,
          })
          .eq('id', editingDrug.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('drugs')
          .insert({
            ndc: drug.ndc,
            drug_name: drug.drug_name,
            manufacturer: drug.manufacturer || null,
            package_description: drug.package_description || null,
            unit_cost: drug.unit_cost ? parseFloat(drug.unit_cost as unknown as string) : null,
            source: 'manual',
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drugs'] });
      setIsAddDialogOpen(false);
      setEditingDrug(null);
      setNewDrug({ ndc: '', drug_name: '', manufacturer: '', package_description: '', unit_cost: '' });
      toast({ title: editingDrug ? 'Drug updated' : 'Drug added', description: 'The drug has been saved successfully.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // Delete drug mutation
  const deleteDrugMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('drugs').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['drugs'] });
      toast({ title: 'Drug deleted', description: 'The drug has been removed.' });
    },
    onError: (error: any) => {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    },
  });

  // FDA lookup
  const lookupNdc = async () => {
    if (!ndcLookup.trim()) return;
    
    setIsSearchingFda(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-fda-data', {
        body: { action: 'lookup', ndc: ndcLookup },
      });
      
      if (error) throw error;
      
      if (data.found) {
        setFdaResults([data.drug]);
        toast({ title: 'Drug found', description: `Found: ${data.drug.drug_name}` });
      } else {
        toast({ title: 'Not found', description: data.message, variant: 'destructive' });
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsSearchingFda(false);
    }
  };

  // FDA search by name
  const searchFda = async () => {
    if (!fdaSearchTerm.trim()) return;
    
    setIsSearchingFda(true);
    try {
      const { data, error } = await supabase.functions.invoke('fetch-fda-data', {
        body: { action: 'search', searchTerm: fdaSearchTerm },
      });
      
      if (error) throw error;
      
      setFdaResults(data.results || []);
      if (data.results?.length === 0) {
        toast({ title: 'No results', description: 'No drugs found matching your search.' });
      }
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } finally {
      setIsSearchingFda(false);
    }
  };

  // Import FDA result to database
  const importFdaDrug = async (drug: any) => {
    try {
      const { error } = await supabase.from('drugs').upsert({
        ndc: drug.ndc,
        drug_name: drug.drug_name,
        manufacturer: drug.manufacturer,
        package_description: drug.package_description,
        dea_schedule: drug.dea_schedule,
        fda_status: drug.fda_status,
        source: 'fda',
      }, { onConflict: 'ndc' });
      
      if (error) throw error;
      
      queryClient.invalidateQueries({ queryKey: ['drugs'] });
      toast({ title: 'Imported', description: `${drug.drug_name} has been added to the database.` });
    } catch (error: any) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    }
  };

  const handleEdit = (drug: Drug) => {
    setEditingDrug(drug);
    setNewDrug({
      ndc: drug.ndc,
      drug_name: drug.drug_name,
      manufacturer: drug.manufacturer || '',
      package_description: drug.package_description || '',
      unit_cost: drug.unit_cost?.toString() || '',
    });
    setIsAddDialogOpen(true);
  };

  const handleSave = () => {
    if (!newDrug.ndc || !newDrug.drug_name) {
      toast({ title: 'Error', description: 'NDC and Drug Name are required', variant: 'destructive' });
      return;
    }
    saveDrugMutation.mutate(newDrug);
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Drug Database</h1>
            <p className="text-muted-foreground">Manage NDC codes, costs, and FDA data</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={isFdaDialogOpen} onOpenChange={setIsFdaDialogOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Database className="mr-2 h-4 w-4" />
                  FDA Lookup
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>FDA Drug Lookup</DialogTitle>
                  <DialogDescription>Search the FDA database for drug information</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Label>NDC Code</Label>
                      <div className="flex gap-2 mt-1">
                        <Input
                          placeholder="Enter NDC (e.g., 0069-3150-83)"
                          value={ndcLookup}
                          onChange={(e) => setNdcLookup(e.target.value)}
                        />
                        <Button onClick={lookupNdc} disabled={isSearchingFda}>
                          {isSearchingFda ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Lookup'}
                        </Button>
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <div className="flex-1">
                      <Label>Search by Name</Label>
                      <div className="flex gap-2 mt-1">
                        <Input
                          placeholder="Enter drug name (e.g., Lipitor)"
                          value={fdaSearchTerm}
                          onChange={(e) => setFdaSearchTerm(e.target.value)}
                        />
                        <Button onClick={searchFda} disabled={isSearchingFda}>
                          {isSearchingFda ? <RefreshCw className="h-4 w-4 animate-spin" /> : 'Search'}
                        </Button>
                      </div>
                    </div>
                  </div>
                  
                  {fdaResults.length > 0 && (
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>NDC</TableHead>
                            <TableHead>Drug Name</TableHead>
                            <TableHead>Manufacturer</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead></TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {fdaResults.map((drug, idx) => (
                            <TableRow key={idx}>
                              <TableCell className="font-mono text-sm">{drug.ndc}</TableCell>
                              <TableCell>{drug.drug_name}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">{drug.manufacturer}</TableCell>
                              <TableCell className="text-sm">{drug.fda_status}</TableCell>
                              <TableCell>
                                <Button size="sm" onClick={() => importFdaDrug(drug)}>
                                  <Plus className="h-4 w-4 mr-1" />
                                  Import
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
            
            <Dialog open={isAddDialogOpen} onOpenChange={(open) => {
              setIsAddDialogOpen(open);
              if (!open) {
                setEditingDrug(null);
                setNewDrug({ ndc: '', drug_name: '', manufacturer: '', package_description: '', unit_cost: '' });
              }
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Drug
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{editingDrug ? 'Edit Drug' : 'Add New Drug'}</DialogTitle>
                  <DialogDescription>Enter the drug information manually</DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <Label>NDC Code *</Label>
                    <Input
                      placeholder="0069-3150-83"
                      value={newDrug.ndc}
                      onChange={(e) => setNewDrug({ ...newDrug, ndc: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Drug Name *</Label>
                    <Input
                      placeholder="Lipitor"
                      value={newDrug.drug_name}
                      onChange={(e) => setNewDrug({ ...newDrug, drug_name: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Manufacturer</Label>
                    <Input
                      placeholder="Pfizer"
                      value={newDrug.manufacturer}
                      onChange={(e) => setNewDrug({ ...newDrug, manufacturer: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Package Description</Label>
                    <Input
                      placeholder="90 tablets per bottle"
                      value={newDrug.package_description}
                      onChange={(e) => setNewDrug({ ...newDrug, package_description: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Unit Cost ($)</Label>
                    <Input
                      type="number"
                      step="0.01"
                      placeholder="12.50"
                      value={newDrug.unit_cost}
                      onChange={(e) => setNewDrug({ ...newDrug, unit_cost: e.target.value })}
                    />
                  </div>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>Cancel</Button>
                  <Button onClick={handleSave} disabled={saveDrugMutation.isPending}>
                    {saveDrugMutation.isPending ? 'Saving...' : 'Save'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Search */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Search Drugs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by NDC, drug name, or manufacturer..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Drugs Table */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Drug List</CardTitle>
            <CardDescription>{drugs.length} drugs in database</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="text-center py-8 text-muted-foreground">Loading...</div>
            ) : drugs.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                No drugs found. Add drugs manually or import from FDA.
              </div>
            ) : (
              <div className="border rounded-lg overflow-hidden">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>NDC</TableHead>
                      <TableHead>Drug Name</TableHead>
                      <TableHead>Manufacturer</TableHead>
                      <TableHead>Unit Cost</TableHead>
                      <TableHead>Source</TableHead>
                      <TableHead>Updated</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {drugs.map((drug) => (
                      <TableRow key={drug.id}>
                        <TableCell className="font-mono text-sm">{drug.ndc}</TableCell>
                        <TableCell className="font-medium">{drug.drug_name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{drug.manufacturer || '-'}</TableCell>
                        <TableCell>{drug.unit_cost ? `$${drug.unit_cost.toFixed(2)}` : '-'}</TableCell>
                        <TableCell>
                          <span className={`text-xs px-2 py-1 rounded-full ${
                            drug.source === 'fda' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-700'
                          }`}>
                            {drug.source}
                          </span>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {new Date(drug.updated_at).toLocaleDateString()}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(drug)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => deleteDrugMutation.mutate(drug.id)}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default DrugDatabase;
