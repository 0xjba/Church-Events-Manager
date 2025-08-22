import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Loader2, Plus, Edit, Trash2, Calendar, Trophy } from 'lucide-react';
import Navigation from '@/components/Navigation';

const seasonSchema = z.object({
  name: z.string().min(1, 'Season name is required'),
  year: z.number().min(2020).max(2050),
  description: z.string().optional(),
  is_active: z.boolean().default(false),
});

type SeasonFormData = z.infer<typeof seasonSchema>;

interface Season {
  id: string;
  name: string;
  year: number;
  description: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  event_count?: number;
}

const SeasonManagement = () => {
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingSeason, setEditingSeason] = useState<Season | null>(null);
  const [seasonToDelete, setSeasonToDelete] = useState<Season | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const form = useForm<SeasonFormData>({
    resolver: zodResolver(seasonSchema),
    defaultValues: {
      name: '',
      year: new Date().getFullYear(),
      description: '',
      is_active: false,
    },
  });

  useEffect(() => {
    fetchSeasons();
  }, []);

  const fetchSeasons = async () => {
    try {
      setLoading(true);
      const { data: seasonsData, error: seasonsError } = await supabase
        .from('seasons')
        .select('*')
        .order('year', { ascending: false });

      if (seasonsError) throw seasonsError;

      // Get event counts for each season
      const seasonsWithCounts = await Promise.all(
        seasonsData.map(async (season) => {
          const { count, error } = await supabase
            .from('events')
            .select('*', { count: 'exact', head: true })
            .eq('season_id', season.id);

          if (error) console.error('Error counting events:', error);
          
          return {
            ...season,
            event_count: count || 0,
          };
        })
      );

      setSeasons(seasonsWithCounts);
    } catch (error) {
      console.error('Error fetching seasons:', error);
      toast.error('Failed to fetch seasons');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: SeasonFormData) => {
    try {
      setSubmitting(true);

      if (editingSeason) {
        const { error } = await supabase
          .from('seasons')
          .update({
            name: data.name,
            year: data.year,
            description: data.description || null,
            is_active: data.is_active,
          })
          .eq('id', editingSeason.id);

        if (error) throw error;
        toast.success('Season updated successfully');
      } else {
        const { error } = await supabase
          .from('seasons')
          .insert([{
            name: data.name,
            year: data.year,
            description: data.description || null,
            is_active: data.is_active,
          }]);

        if (error) throw error;
        toast.success('Season created successfully');
      }

      fetchSeasons();
      handleCloseDialog();
    } catch (error: any) {
      console.error('Error saving season:', error);
      toast.error(error.message || 'Failed to save season');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEdit = (season: Season) => {
    setEditingSeason(season);
    form.reset({
      name: season.name,
      year: season.year,
      description: season.description || '',
      is_active: season.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingSeason(null);
    form.reset();
  };

  const handleDeleteClick = (season: Season) => {
    setSeasonToDelete(season);
    setIsDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!seasonToDelete) return;

    try {
      setSubmitting(true);
      
      // Delete the season (cascade will handle events and related data)
      const { error } = await supabase
        .from('seasons')
        .delete()
        .eq('id', seasonToDelete.id);

      if (error) throw error;

      toast.success(`Season "${seasonToDelete.name}" and all its events deleted successfully`);
      fetchSeasons();
      setIsDeleteDialogOpen(false);
      setSeasonToDelete(null);
    } catch (error: any) {
      console.error('Error deleting season:', error);
      toast.error(error.message || 'Failed to delete season');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-secondary/10">
      <Navigation />
      
      <main className="container mx-auto px-4 py-8 space-y-8">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div>
            <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-primary to-primary/80 bg-clip-text text-transparent">
              Season Management
            </h1>
            <p className="text-muted-foreground mt-2">
              Organize events by seasons and manage competition cycles
            </p>
          </div>
          <Button 
            onClick={() => setIsDialogOpen(true)}
            size="lg"
            className="bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary/80 shadow-lg hover:shadow-xl transition-all"
          >
            <Plus className="h-5 w-5 mr-2" />
            Create Season
          </Button>
        </div>

        <Card className="shadow-xl border-0 bg-card/50 backdrop-blur-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5" />
              Seasons
            </CardTitle>
            <CardDescription>
              Manage competition seasons and their associated events
            </CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : seasons.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Trophy className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No seasons found. Create your first season to get started.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Season</TableHead>
                      <TableHead>Year</TableHead>
                      <TableHead>Description</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Events</TableHead>
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {seasons.map((season) => (
                      <TableRow key={season.id}>
                        <TableCell className="font-medium">{season.name}</TableCell>
                        <TableCell>{season.year}</TableCell>
                        <TableCell className="max-w-xs truncate">
                          {season.description || '-'}
                        </TableCell>
                        <TableCell>
                          <Badge variant={season.is_active ? 'default' : 'secondary'}>
                            {season.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {season.event_count} events
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleEdit(season)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleDeleteClick(season)}
                              className="text-destructive hover:text-destructive"
                            >
                              <Trash2 className="h-4 w-4" />
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
      </main>

      {/* Create/Edit Season Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={handleCloseDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingSeason ? 'Edit Season' : 'Create Season'}
            </DialogTitle>
            <DialogDescription>
              {editingSeason 
                ? 'Update the season details below.' 
                : 'Create a new season to organize your events.'
              }
            </DialogDescription>
          </DialogHeader>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Season Name</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g., Spring Championship" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="year"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Year</FormLabel>
                    <FormControl>
                      <Input 
                        type="number" 
                        min="2020" 
                        max="2050" 
                        placeholder="2024"
                        {...field}
                        onChange={(e) => field.onChange(parseInt(e.target.value) || new Date().getFullYear())}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Description (Optional)</FormLabel>
                    <FormControl>
                      <Textarea 
                        placeholder="Season description..."
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="is_active"
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                    <div className="space-y-0.5">
                      <FormLabel className="text-base">Active Season</FormLabel>
                      <div className="text-sm text-muted-foreground">
                        Mark this season as currently active
                      </div>
                    </div>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />

              <DialogFooter>
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleCloseDialog}
                  disabled={submitting}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  {editingSeason ? 'Update Season' : 'Create Season'}
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Season</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete the season "{seasonToDelete?.name}" ({seasonToDelete?.year})?
              <br /><br />
              <strong className="text-destructive">
                This will permanently delete all {seasonToDelete?.event_count} events in this season 
                and all associated data (participants, judges, scores, results).
              </strong>
              <br /><br />
              This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={handleDeleteConfirm}
              disabled={submitting}
              className="bg-destructive hover:bg-destructive/80"
            >
              {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Delete Season
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SeasonManagement;