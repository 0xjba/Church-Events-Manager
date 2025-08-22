import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import Navigation from '@/components/Navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Plus, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

const judgeSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  church: z.string().min(1, 'Church is required'),
  contact: z.string().optional(),
});

type JudgeFormData = z.infer<typeof judgeSchema>;

interface Judge extends JudgeFormData {
  id: string;
  profile_id: string;
  created_at: string;
}

const JudgeManagement = () => {
  const [judges, setJudges] = useState<Judge[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingJudge, setEditingJudge] = useState<Judge | null>(null);

  const form = useForm<JudgeFormData>({
    resolver: zodResolver(judgeSchema),
    defaultValues: {
      name: '',
      church: '',
      contact: '',
    },
  });

  useEffect(() => {
    fetchJudges();
  }, []);

  const fetchJudges = async () => {
    try {
      const { data, error } = await supabase
        .from('judges')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setJudges(data || []);
    } catch (error) {
      toast.error('Failed to load judges');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: JudgeFormData) => {
    try {
      if (editingJudge) {
        // Update existing judge
        const { error } = await supabase
          .from('judges')
          .update(data)
          .eq('id', editingJudge.id);

        if (error) throw error;
        toast.success('Judge updated successfully');
      } else {
        // Create the judge record (profile will be created via trigger)
        const { error: judgeError } = await supabase
          .from('judges')
          .insert({
            name: data.name,
            church: data.church,
            contact: data.contact || null,
            profile_id: crypto.randomUUID() // Temporary, will be updated via trigger
          });

        if (judgeError) throw judgeError;
        toast.success('Judge added successfully');
      }

      setIsDialogOpen(false);
      form.reset();
      setEditingJudge(null);
      fetchJudges();
    } catch (error) {
      toast.error(editingJudge ? 'Failed to update judge' : 'Failed to add judge');
    }
  };

  const handleEdit = (judge: Judge) => {
    setEditingJudge(judge);
    form.reset(judge);
    setIsDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this judge?')) return;

    try {
      const { error } = await supabase
        .from('judges')
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast.success('Judge deleted successfully');
      fetchJudges();
    } catch (error) {
      toast.error('Failed to delete judge');
    }
  };

  return (
    <div className="flex min-h-screen bg-background">
      <div className="w-64 hidden md:block">
        <Navigation />
      </div>
      
      <div className="flex-1 pb-16 md:pb-0">
        <div className="p-4 md:p-6">
          <div className="flex justify-between items-center mb-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                Judge Management
              </h1>
              <p className="text-muted-foreground">
                Manage event judges
              </p>
            </div>
            
            <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
              <DialogTrigger asChild>
                <Button onClick={() => {
                  setEditingJudge(null);
                  form.reset();
                }}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Judge
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                  <DialogTitle>
                    {editingJudge ? 'Edit Judge' : 'Add New Judge'}
                  </DialogTitle>
                  <DialogDescription>
                    Fill in the judge details below.
                  </DialogDescription>
                </DialogHeader>
                
                <Form {...form}>
                  <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                    <FormField
                      control={form.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Judge Name</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="church"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Church</FormLabel>
                          <FormControl>
                            <Input {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <FormField
                      control={form.control}
                      name="contact"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Contact (Optional)</FormLabel>
                          <FormControl>
                            <Input {...field} placeholder="Phone or email" />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    
                    <div className="flex justify-end space-x-2">
                      <Button type="button" variant="outline" onClick={() => setIsDialogOpen(false)}>
                        Cancel
                      </Button>
                      <Button type="submit">
                        {editingJudge ? 'Update' : 'Add'} Judge
                      </Button>
                    </div>
                  </form>
                </Form>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Judges</CardTitle>
              <CardDescription>
                All registered judges
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loading ? (
                <div className="text-center py-8">Loading...</div>
              ) : judges.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No judges registered yet
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Church</TableHead>
                        <TableHead>Contact</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {judges.map((judge) => (
                        <TableRow key={judge.id}>
                          <TableCell className="font-medium">
                            {judge.name}
                          </TableCell>
                          <TableCell>{judge.church}</TableCell>
                          <TableCell>{judge.contact || 'N/A'}</TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleEdit(judge)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleDelete(judge.id)}
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
        </div>
      </div>

      <div className="md:hidden">
        <Navigation />
      </div>
    </div>
  );
};

export default JudgeManagement;