import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ResultsCalculator, EventResults, ResultData } from '@/utils/resultsCalculator';
import Navigation from '@/components/Navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calculator, Eye, EyeOff, Download, FileText, Trophy, RefreshCw } from 'lucide-react';
import { ExportUtils } from '@/utils/exportUtils';
import { toast } from 'sonner';

interface Event {
  id: string;
  name: string;
  type: string;
  status: string;
  results_published: boolean;
  event_order: number | null;
}

const ResultsManagement = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [eventResults, setEventResults] = useState<EventResults | null>(null);
  const [championshipData, setChampionshipData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [showResultsDialog, setShowResultsDialog] = useState(false);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .order('event_order', { ascending: true, nullsFirst: false });

      if (error) throw error;
      setEvents(data || []);
    } catch (error) {
      toast.error('Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  const calculateResults = async (eventId: string) => {
    setCalculating(true);
    try {
      const results = await ResultsCalculator.calculateAndSaveEventResults(eventId);
      setEventResults(results);
      toast.success('Results calculated successfully!');
    } catch (error) {
      toast.error('Failed to calculate results');
    } finally {
      setCalculating(false);
    }
  };

  const toggleResultsPublication = async (eventId: string, publish: boolean) => {
    try {
      const { error } = await supabase
        .from('events')
        .update({ results_published: publish })
        .eq('id', eventId);

      if (error) throw error;
      
      setEvents(prev => prev.map(event => 
        event.id === eventId 
          ? { ...event, results_published: publish }
          : event
      ));
      
      toast.success(publish ? 'Results published!' : 'Results unpublished!');
    } catch (error) {
      toast.error('Failed to update publication status');
    }
  };

  const loadEventResults = async (event: Event) => {
    setSelectedEvent(event);
    setCalculating(true);
    
    try {
      const results = await ResultsCalculator.calculateEventResults(event.id);
      setEventResults(results);
      setShowResultsDialog(true);
    } catch (error) {
      toast.error('Failed to load event results');
    } finally {
      setCalculating(false);
    }
  };

  const calculateChampionshipStandings = async () => {
    setCalculating(true);
    try {
      const publishedEventIds = events
        .filter(e => e.results_published)
        .map(e => e.id);
      
      const standings = await ResultsCalculator.getChampionshipStandings(publishedEventIds);
      setChampionshipData(standings);
      toast.success('Championship standings calculated!');
    } catch (error) {
      toast.error('Failed to calculate championship standings');
    } finally {
      setCalculating(false);
    }
  };

  const exportToExcel = async (eventId?: string) => {
    try {
      if (eventId && eventResults) {
        const event = events.find(e => e.id === eventId);
        const exportData = {
          event_name: event?.name || 'Event Results',
          results: eventResults.results,
          criteria: eventResults.criteria,
          generated_at: new Date().toLocaleString()
        };
        ExportUtils.downloadCSV(exportData);
        toast.success('Results exported to CSV!');
      } else if (championshipData) {
        ExportUtils.downloadChampionshipCSV(championshipData);
        toast.success('Championship standings exported to CSV!');
      } else {
        toast.error('No data available to export');
      }
    } catch (error) {
      toast.error('Failed to export to Excel');
    }
  };

  const generatePrintableReport = async (eventId?: string) => {
    try {
      if (eventId && eventResults) {
        const event = events.find(e => e.id === eventId);
        const exportData = {
          event_name: event?.name || 'Event Results',
          results: eventResults.results,
          criteria: eventResults.criteria,
          generated_at: new Date().toLocaleString()
        };
        ExportUtils.openPrintableReport(exportData);
      } else {
        toast.error('No event data available for printing');
      }
    } catch (error) {
      toast.error('Failed to generate printable report');
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen bg-background">
        <div className="w-64 hidden md:block">
          <Navigation />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">Loading...</div>
        </div>
      </div>
    );
  }

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
                Results Management
              </h1>
              <p className="text-muted-foreground">
                Calculate, publish, and export competition results
              </p>
            </div>
            
            <div className="flex space-x-2">
              <Button onClick={calculateChampionshipStandings} disabled={calculating}>
                <Trophy className="h-4 w-4 mr-2" />
                Championship Standings
              </Button>
              <Button onClick={() => exportToExcel()} variant="outline">
                <Download className="h-4 w-4 mr-2" />
                Export All
              </Button>
            </div>
          </div>

          {/* Championship Standings */}
          {championshipData && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Trophy className="h-5 w-5 mr-2 text-yellow-500" />
                  Championship Standings
                </CardTitle>
                <CardDescription>
                  Overall rankings across {championshipData.events_count} published events
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Rank</TableHead>
                        <TableHead>Participant</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Church</TableHead>
                        <TableHead>Events</TableHead>
                        <TableHead>Championship Points</TableHead>
                        <TableHead>Avg Score</TableHead>
                        <TableHead>Best Rank</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {championshipData.participants.slice(0, 10).map((participant: any) => (
                        <TableRow key={participant.participant.id}>
                          <TableCell className="font-bold">
                            {participant.rank === 1 && '🥇'}
                            {participant.rank === 2 && '🥈'}
                            {participant.rank === 3 && '🥉'}
                            {participant.rank > 3 && `#${participant.rank}`}
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{participant.participant.full_name}</div>
                              <div className="text-sm text-muted-foreground">
                                #{participant.participant.chest_number}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>{participant.participant.category}</TableCell>
                          <TableCell>{participant.participant.church}</TableCell>
                          <TableCell>{participant.events_participated}</TableCell>
                          <TableCell className="font-bold">{participant.total_championship_points}</TableCell>
                          <TableCell>{participant.average_score.toFixed(1)}</TableCell>
                          <TableCell>#{participant.best_rank}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Events Results Management */}
          <Card>
            <CardHeader>
              <CardTitle>Event Results</CardTitle>
              <CardDescription>
                Calculate results and manage publication status for each event
              </CardDescription>
            </CardHeader>
            <CardContent>
              {events.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No events found
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Event</TableHead>
                        <TableHead>Type</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Results Status</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {events.map((event) => (
                        <TableRow key={event.id}>
                          <TableCell>
                            <div>
                              <div className="font-medium">{event.name}</div>
                              {event.event_order && (
                                <div className="text-sm text-muted-foreground">
                                  Order: {event.event_order}
                                </div>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="capitalize">{event.type}</TableCell>
                          <TableCell>
                            <Badge variant={event.status === 'completed' ? 'default' : 'secondary'}>
                              {event.status}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={event.results_published ? 'default' : 'outline'}>
                              {event.results_published ? (
                                <>
                                  <Eye className="h-3 w-3 mr-1" />
                                  Published
                                </>
                              ) : (
                                <>
                                  <EyeOff className="h-3 w-3 mr-1" />
                                  Unpublished
                                </>
                              )}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex space-x-2">
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => calculateResults(event.id)}
                                disabled={calculating}
                              >
                                <Calculator className="h-3 w-3 mr-1" />
                                Calculate
                              </Button>
                              
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => loadEventResults(event)}
                                disabled={calculating}
                              >
                                <Eye className="h-3 w-3 mr-1" />
                                View
                              </Button>
                              
                              <Button
                                size="sm"
                                variant={event.results_published ? 'destructive' : 'default'}
                                onClick={() => toggleResultsPublication(event.id, !event.results_published)}
                              >
                                {event.results_published ? (
                                  <>
                                    <EyeOff className="h-3 w-3 mr-1" />
                                    Unpublish
                                  </>
                                ) : (
                                  <>
                                    <Eye className="h-3 w-3 mr-1" />
                                    Publish
                                  </>
                                )}
                              </Button>
                              
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => exportToExcel(event.id)}
                              >
                                <Download className="h-3 w-3" />
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

      {/* Results Dialog */}
      <Dialog open={showResultsDialog} onOpenChange={setShowResultsDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedEvent?.name} - Results
            </DialogTitle>
            <DialogDescription>
              Event results calculated on {eventResults?.last_calculated.toLocaleString()}
            </DialogDescription>
          </DialogHeader>
          
          {eventResults && (
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <div className="text-sm text-muted-foreground">
                  {eventResults.total_participants} participants • {eventResults.criteria.length} criteria
                </div>
                <div className="flex space-x-2">
                  <Button size="sm" variant="outline" onClick={() => exportToExcel(selectedEvent?.id)}>
                    <Download className="h-3 w-3 mr-1" />
                    Excel
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => generatePrintableReport(selectedEvent?.id)}>
                    <FileText className="h-3 w-3 mr-1" />
                    Print
                  </Button>
                </div>
              </div>
              
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Rank</TableHead>
                      <TableHead>Participant</TableHead>
                      <TableHead>Category</TableHead>
                      <TableHead>Church</TableHead>
                      <TableHead>Total Score</TableHead>
                      <TableHead>Average</TableHead>
                      {eventResults.criteria.map(criteria => (
                        <TableHead key={criteria.id} className="text-center">
                          {criteria.name}
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {eventResults.results.map((result) => (
                      <TableRow key={result.participant_id}>
                        <TableCell className="font-bold">
                          {result.rank === 1 && '🥇'}
                          {result.rank === 2 && '🥈'}
                          {result.rank === 3 && '🥉'}
                          {result.rank > 3 && `#${result.rank}`}
                          {result.tie_breaker_reason && (
                            <div className="text-xs text-muted-foreground">
                              {result.tie_breaker_reason}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <div>
                            <div className="font-medium">{result.participant.full_name}</div>
                            <div className="text-sm text-muted-foreground">
                              #{result.participant.chest_number}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>{result.participant.category}</TableCell>
                        <TableCell>{result.participant.church}</TableCell>
                        <TableCell className="font-bold">{result.total_score}</TableCell>
                        <TableCell>{result.average_score}</TableCell>
                        {eventResults.criteria.map(criteria => (
                          <TableCell key={criteria.id} className="text-center">
                            {result.criteria_scores[criteria.id]?.toFixed(1) || '0.0'}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ResultsManagement;