import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useRealtimeScores } from '@/hooks/useRealtimeScores';
import Navigation from '@/components/Navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { RefreshCw, Lock, Unlock } from 'lucide-react';
import { toast } from 'sonner';

interface Event {
  id: string;
  name: string;
  type: string;
  status: string;
}

interface Participant {
  id: string;
  full_name: string;
  chest_number: string;
  category: string;
}

interface Judge {
  id: string;
  name: string;
  church: string;
}

interface Criteria {
  id: string;
  name: string;
  max_score: number;
  weight: number;
}

interface ScoreWithDetails {
  id: string;
  participant_id: string;
  judge_id: string;
  criteria_id: string;
  score: number;
  is_locked: boolean;
  participant_name: string;
  judge_name: string;
  criteria_name: string;
  updated_at: string;
}

const RealtimeScoreboard = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const [event, setEvent] = useState<Event | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [judges, setJudges] = useState<Judge[]>([]);
  const [criteria, setCriteria] = useState<Criteria[]>([]);
  const [scoresWithDetails, setScoresWithDetails] = useState<ScoreWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  const { scores } = useRealtimeScores({
    eventId,
    onScoreUpdate: (score) => {
      toast.success(`New score submitted: ${score.score}`);
      enrichScoreData([score]);
    }
  });

  useEffect(() => {
    if (eventId) {
      fetchEventData();
    }
  }, [eventId]);

  useEffect(() => {
    if (scores.length > 0 && participants.length > 0 && judges.length > 0 && criteria.length > 0) {
      enrichScoreData(scores);
    }
  }, [scores, participants, judges, criteria]);

  const fetchEventData = async () => {
    if (!eventId) return;

    try {
      // Fetch event details
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();

      if (eventError) throw eventError;
      setEvent(eventData);

      // Fetch participants
      const { data: participantData, error: participantError } = await supabase
        .from('event_participants')
        .select(`
          participants (
            id,
            full_name,
            chest_number,
            category
          )
        `)
        .eq('event_id', eventId);

      if (participantError) throw participantError;
      setParticipants(participantData.map(ep => ep.participants).filter(Boolean));

      // Fetch judges
      const { data: judgeData, error: judgeError } = await supabase
        .from('event_judges')
        .select(`
          judges (
            id,
            name,
            church
          )
        `)
        .eq('event_id', eventId);

      if (judgeError) throw judgeError;
      setJudges(judgeData.map(ej => ej.judges).filter(Boolean));

      // Fetch criteria
      const { data: criteriaData, error: criteriaError } = await supabase
        .from('event_criteria')
        .select('*')
        .eq('event_id', eventId);

      if (criteriaError) throw criteriaError;
      setCriteria(criteriaData);

    } catch (error) {
      toast.error('Failed to load event data');
    } finally {
      setLoading(false);
    }
  };

  const enrichScoreData = (rawScores: any[]) => {
    const enriched = rawScores.map(score => {
      const participant = participants.find(p => p.id === score.participant_id);
      const judge = judges.find(j => j.id === score.judge_id);
      const criterion = criteria.find(c => c.id === score.criteria_id);

      return {
        ...score,
        participant_name: participant?.full_name || 'Unknown',
        judge_name: judge?.name || 'Unknown',
        criteria_name: criterion?.name || 'Unknown',
      };
    });

    setScoresWithDetails(enriched);
  };

  const unlockScore = async (scoreId: string) => {
    try {
      const { error } = await supabase
        .from('scores')
        .update({ 
          is_locked: false,
          unlock_reason: 'Unlocked by admin for editing'
        })
        .eq('id', scoreId);

      if (error) throw error;
      toast.success('Score unlocked successfully');
    } catch (error) {
      toast.error('Failed to unlock score');
    }
  };

  const lockScore = async (scoreId: string) => {
    try {
      const { error } = await supabase
        .from('scores')
        .update({ 
          is_locked: true,
          unlock_reason: null
        })
        .eq('id', scoreId);

      if (error) throw error;
      toast.success('Score locked successfully');
    } catch (error) {
      toast.error('Failed to lock score');
    }
  };

  const getScoreMatrixData = () => {
    const matrix: { [participantId: string]: { [judgeId: string]: { [criteriaId: string]: number } } } = {};
    
    scoresWithDetails.forEach(score => {
      if (!matrix[score.participant_id]) {
        matrix[score.participant_id] = {};
      }
      if (!matrix[score.participant_id][score.judge_id]) {
        matrix[score.participant_id][score.judge_id] = {};
      }
      matrix[score.participant_id][score.judge_id][score.criteria_id] = score.score;
    });

    return matrix;
  };

  const calculateParticipantTotal = (participantId: string) => {
    const participantScores = scoresWithDetails.filter(s => s.participant_id === participantId);
    
    // Group by criteria and calculate average across judges
    const criteriaAverages: { [criteriaId: string]: number } = {};
    
    criteria.forEach(criterion => {
      const criteriaScores = participantScores.filter(s => s.criteria_id === criterion.id);
      if (criteriaScores.length > 0) {
        const average = criteriaScores.reduce((sum, s) => sum + s.score, 0) / criteriaScores.length;
        criteriaAverages[criterion.id] = average * criterion.weight;
      }
    });

    return Object.values(criteriaAverages).reduce((sum, score) => sum + score, 0);
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

  const scoreMatrix = getScoreMatrixData();

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
                Real-time Scoreboard
              </h1>
              <p className="text-muted-foreground">
                {event?.name} - Live scoring updates
              </p>
            </div>
            <Button onClick={() => window.location.reload()}>
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{participants.length}</div>
                <p className="text-sm text-muted-foreground">Participants</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{judges.length}</div>
                <p className="text-sm text-muted-foreground">Judges</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">{scoresWithDetails.length}</div>
                <p className="text-sm text-muted-foreground">Scores Submitted</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-2xl font-bold">
                  {scoresWithDetails.filter(s => s.is_locked).length}
                </div>
                <p className="text-sm text-muted-foreground">Locked Scores</p>
              </CardContent>
            </Card>
          </div>

          {/* Score Matrix */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>Scoring Matrix</CardTitle>
              <CardDescription>
                Live view of all scores by participant and judge
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Participant</TableHead>
                      {judges.map(judge => (
                        <TableHead key={judge.id} className="text-center">
                          {judge.name}
                        </TableHead>
                      ))}
                      <TableHead className="text-center font-bold">Total</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {participants.map(participant => {
                      const total = calculateParticipantTotal(participant.id);
                      return (
                        <TableRow key={participant.id}>
                          <TableCell className="font-medium">
                            <div>
                              <div>#{participant.chest_number} {participant.full_name}</div>
                              <div className="text-sm text-muted-foreground">{participant.category}</div>
                            </div>
                          </TableCell>
                          {judges.map(judge => {
                            const judgeScores = scoreMatrix[participant.id]?.[judge.id] || {};
                            const judgeTotal = criteria.reduce((sum, criterion) => {
                              const score = judgeScores[criterion.id] || 0;
                              return sum + (score * criterion.weight);
                            }, 0);
                            
                            return (
                              <TableCell key={judge.id} className="text-center">
                                <div className="space-y-1">
                                  {criteria.map(criterion => {
                                    const score = judgeScores[criterion.id];
                                    return score !== undefined ? (
                                      <div key={criterion.id} className="text-xs">
                                        {criterion.name}: {score}/{criterion.max_score}
                                      </div>
                                    ) : (
                                      <div key={criterion.id} className="text-xs text-muted-foreground">
                                        {criterion.name}: -
                                      </div>
                                    );
                                  })}
                                  <div className="font-medium pt-1 border-t">
                                    {judgeTotal.toFixed(1)}
                                  </div>
                                </div>
                              </TableCell>
                            );
                          })}
                          <TableCell className="text-center font-bold text-lg">
                            {total.toFixed(1)}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>

          {/* Recent Score Updates */}
          <Card>
            <CardHeader>
              <CardTitle>Recent Score Updates</CardTitle>
              <CardDescription>
                Latest score submissions and changes
              </CardDescription>
            </CardHeader>
            <CardContent>
              {scoresWithDetails.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  No scores submitted yet
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Participant</TableHead>
                        <TableHead>Judge</TableHead>
                        <TableHead>Criteria</TableHead>
                        <TableHead>Score</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Updated</TableHead>
                        <TableHead>Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {scoresWithDetails
                        .sort((a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime())
                        .slice(0, 20) // Show latest 20 scores
                        .map(score => (
                        <TableRow key={score.id}>
                          <TableCell>{score.participant_name}</TableCell>
                          <TableCell>{score.judge_name}</TableCell>
                          <TableCell>{score.criteria_name}</TableCell>
                          <TableCell className="font-medium">{score.score}</TableCell>
                          <TableCell>
                            <Badge variant={score.is_locked ? 'default' : 'secondary'}>
                              {score.is_locked ? 'Locked' : 'Unlocked'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {new Date(score.updated_at).toLocaleTimeString()}
                          </TableCell>
                          <TableCell>
                            {score.is_locked ? (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => unlockScore(score.id)}
                              >
                                <Unlock className="h-3 w-3" />
                              </Button>
                            ) : (
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => lockScore(score.id)}
                              >
                                <Lock className="h-3 w-3" />
                              </Button>
                            )}
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

export default RealtimeScoreboard;