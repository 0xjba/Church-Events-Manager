import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ResultsCalculator } from '@/utils/resultsCalculator';
import Navigation from '@/components/Navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Trophy, Medal, Award, Filter, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface Event {
  id: string;
  name: string;
  type: string;
  status: string;
  results_published: boolean;
}

interface EventResult {
  id: string;
  participant_id: string;
  total_score: number;
  average_score: number;
  rank: number;
  tie_breaker_reason: string | null;
  participants: {
    id: string;
    full_name: string;
    chest_number: string;
    category: string;
    church: string;
    district: string;
  };
}

const Leaderboard = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<string>('');
  const [eventResults, setEventResults] = useState<EventResult[]>([]);
  const [championshipData, setChampionshipData] = useState<any>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [categories, setCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [showChampionship, setShowChampionship] = useState(false);

  useEffect(() => {
    fetchPublishedEvents();
    fetchCategories();
  }, []);

  useEffect(() => {
    if (selectedEvent) {
      fetchEventResults(selectedEvent);
    }
  }, [selectedEvent, selectedCategory]);

  const fetchPublishedEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('results_published', true)
        .order('event_order', { ascending: true, nullsFirst: false });

      if (error) throw error;
      setEvents(data || []);
      
      if (data && data.length > 0) {
        setSelectedEvent(data[0].id);
      }
    } catch (error) {
      toast.error('Failed to load published events');
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('participants')
        .select('category')
        .neq('category', null);

      if (error) throw error;
      
      const uniqueCategories = [...new Set(data?.map(p => p.category) || [])];
      setCategories(uniqueCategories);
    } catch (error) {
      console.error('Failed to load categories:', error);
    }
  };

  const fetchEventResults = async (eventId: string) => {
    try {
      const { data, error } = await supabase
        .from('results')
        .select(`
          *,
          participants (
            id,
            full_name,
            chest_number,
            category,
            church,
            district
          )
        `)
        .eq('event_id', eventId)
        .order('rank', { ascending: true });

      if (error) throw error;
      
      let filteredResults = data || [];
      
      // Filter by category if selected
      if (selectedCategory !== 'all') {
        filteredResults = filteredResults.filter(
          result => result.participants?.category === selectedCategory
        );
      }
      
      setEventResults(filteredResults);
    } catch (error) {
      toast.error('Failed to load event results');
    }
  };

  const fetchChampionshipStandings = async () => {
    try {
      const eventIds = events.map(e => e.id);
      const standings = await ResultsCalculator.getChampionshipStandings(eventIds);
      
      let filteredStandings = standings.participants;
      
      // Filter by category if selected
      if (selectedCategory !== 'all') {
        filteredStandings = filteredStandings.filter(
          participant => participant.participant.category === selectedCategory
        );
        
        // Re-rank after filtering
        filteredStandings.forEach((participant, index) => {
          participant.rank = index + 1;
        });
      }
      
      setChampionshipData({
        ...standings,
        participants: filteredStandings
      });
      
      setShowChampionship(true);
    } catch (error) {
      toast.error('Failed to load championship standings');
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy className="h-5 w-5 text-yellow-500" />;
      case 2:
        return <Medal className="h-5 w-5 text-gray-400" />;
      case 3:
        return <Award className="h-5 w-5 text-amber-600" />;
      default:
        return <span className="font-bold">#{rank}</span>;
    }
  };

  const getRankEmoji = (rank: number) => {
    switch (rank) {
      case 1: return '🥇';
      case 2: return '🥈';
      case 3: return '🥉';
      default: return `#${rank}`;
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
                Leaderboard
              </h1>
              <p className="text-muted-foreground">
                Competition results and rankings
              </p>
            </div>
            
            <Button onClick={fetchChampionshipStandings}>
              <Trophy className="h-4 w-4 mr-2" />
              Championship Standings
            </Button>
          </div>

          {/* Filters */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block">Event</label>
                  <Select value={selectedEvent} onValueChange={setSelectedEvent}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select event" />
                    </SelectTrigger>
                    <SelectContent>
                      {events.map(event => (
                        <SelectItem key={event.id} value={event.id}>
                          {event.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex-1">
                  <label className="text-sm font-medium mb-2 block">Category</label>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Categories</SelectItem>
                      {categories.map(category => (
                        <SelectItem key={category} value={category}>
                          {category}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="flex items-end">
                  <Button
                    variant="outline"
                    onClick={() => setShowChampionship(!showChampionship)}
                  >
                    {showChampionship ? 'Event Results' : 'Championship'}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Championship Standings */}
          {showChampionship && championshipData ? (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Trophy className="h-6 w-6 mr-2 text-yellow-500" />
                  Championship Standings
                  {selectedCategory !== 'all' && (
                    <Badge variant="outline" className="ml-2">
                      {selectedCategory}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Overall rankings across {championshipData.events_count} events
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">Rank</TableHead>
                        <TableHead>Participant</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead>Church</TableHead>
                        <TableHead>District</TableHead>
                        <TableHead>Events</TableHead>
                        <TableHead>Championship Points</TableHead>
                        <TableHead>Avg Score</TableHead>
                        <TableHead>Best Rank</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {championshipData.participants.map((participant: any, index: number) => (
                        <TableRow key={participant.participant.id} className={index < 3 ? 'bg-muted/30' : ''}>
                          <TableCell>
                            <div className="flex items-center justify-center">
                              {getRankIcon(participant.rank)}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div>
                              <div className="font-medium">{participant.participant.full_name}</div>
                              <div className="text-sm text-muted-foreground">
                                #{participant.participant.chest_number}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell className="capitalize">{participant.participant.category}</TableCell>
                          <TableCell>{participant.participant.church}</TableCell>
                          <TableCell>{participant.participant.district}</TableCell>
                          <TableCell>{participant.events_participated}</TableCell>
                          <TableCell className="font-bold text-lg">
                            {participant.total_championship_points}
                          </TableCell>
                          <TableCell>{participant.average_score.toFixed(1)}</TableCell>
                          <TableCell>#{participant.best_rank}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          ) : (
            /* Event Results */
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <Medal className="h-5 w-5 mr-2" />
                  {events.find(e => e.id === selectedEvent)?.name || 'Event Results'}
                  {selectedCategory !== 'all' && (
                    <Badge variant="outline" className="ml-2">
                      {selectedCategory}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription>
                  Event leaderboard and participant rankings
                </CardDescription>
              </CardHeader>
              <CardContent>
                {eventResults.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    {selectedEvent ? 'No results available for this event' : 'Select an event to view results'}
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-16">Rank</TableHead>
                          <TableHead>Participant</TableHead>
                          <TableHead>Category</TableHead>
                          <TableHead>Church</TableHead>
                          <TableHead>District</TableHead>
                          <TableHead>Total Score</TableHead>
                          <TableHead>Average Score</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {eventResults.map((result, index) => (
                          <TableRow key={result.id} className={index < 3 ? 'bg-muted/30' : ''}>
                            <TableCell>
                              <div className="flex flex-col items-center">
                                <div className="text-lg">
                                  {getRankEmoji(result.rank)}
                                </div>
                                {result.tie_breaker_reason && (
                                  <Badge variant="outline" className="text-xs mt-1">
                                    Tie
                                  </Badge>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <div>
                                <div className="font-medium">{result.participants.full_name}</div>
                                <div className="text-sm text-muted-foreground">
                                  #{result.participants.chest_number}
                                </div>
                              </div>
                            </TableCell>
                            <TableCell className="capitalize">{result.participants.category}</TableCell>
                            <TableCell>{result.participants.church}</TableCell>
                            <TableCell>{result.participants.district}</TableCell>
                            <TableCell className="font-bold text-lg">{result.total_score}</TableCell>
                            <TableCell>{result.average_score}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          )}

          {events.length === 0 && (
            <Card>
              <CardContent className="text-center py-8">
                <Trophy className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-lg font-medium mb-2">No Published Results</h3>
                <p className="text-muted-foreground">
                  Results will appear here once events are completed and published by administrators.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      <div className="md:hidden">
        <Navigation />
      </div>
    </div>
  );
};

export default Leaderboard;