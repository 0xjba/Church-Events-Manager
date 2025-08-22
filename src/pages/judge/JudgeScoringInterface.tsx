import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import Navigation from '@/components/Navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Slider } from '@/components/ui/slider';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Progress } from '@/components/ui/progress';
import { Clock, Play, Pause, Save, AlertTriangle, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';

interface Event {
  id: string;
  name: string;
  type: string;
  time_limit: number | null;
  status: string;
}

interface Participant {
  id: string;
  full_name: string;
  chest_number: string;
  category: string;
  church: string;
}

interface Criteria {
  id: string;
  name: string;
  max_score: number;
  weight: number;
}

interface Score {
  participant_id: string;
  criteria_id: string;
  score: number;
}

interface ExistingScore {
  id: string;
  participant_id: string;
  criteria_id: string;
  score: number;
  is_locked: boolean;
}

const JudgeScoringInterface = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { profile } = useAuth();
  
  const [event, setEvent] = useState<Event | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [criteria, setCriteria] = useState<Criteria[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [existingScores, setExistingScores] = useState<ExistingScore[]>([]);
  const [currentParticipantIndex, setCurrentParticipantIndex] = useState(0);
  const [timer, setTimer] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [judgeId, setJudgeId] = useState<string | null>(null);

  useEffect(() => {
    fetchEventData();
    fetchJudgeId();
  }, [eventId]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (isTimerRunning && timer > 0) {
      interval = setInterval(() => {
        setTimer(prev => {
          if (prev <= 1) {
            setIsTimerRunning(false);
            toast.warning("Time's up!");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timer]);

  const fetchJudgeId = async () => {
    if (!profile?.id) return;
    
    try {
      const { data, error } = await supabase
        .from('judges')
        .select('id')
        .eq('profile_id', profile.id)
        .single();
        
      if (error) throw error;
      setJudgeId(data.id);
    } catch (error) {
      toast.error('Failed to get judge information');
      navigate('/judge');
    }
  };

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
      
      if (eventData.time_limit) {
        setTimer(eventData.time_limit * 60); // Convert minutes to seconds
      }

      // Fetch participants for this event
      const { data: participantData, error: participantError } = await supabase
        .from('event_participants')
        .select(`
          participants (
            id,
            full_name,
            chest_number,
            category,
            church
          )
        `)
        .eq('event_id', eventId)
        .order('registered_at');
      
      if (participantError) throw participantError;
      setParticipants(participantData.map(ep => ep.participants).filter(Boolean));

      // Fetch scoring criteria
      const { data: criteriaData, error: criteriaError } = await supabase
        .from('event_criteria')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at');
      
      if (criteriaError) throw criteriaError;
      setCriteria(criteriaData);

      // Fetch existing scores
      if (judgeId) {
        const { data: scoresData, error: scoresError } = await supabase
          .from('scores')
          .select('*')
          .eq('event_id', eventId)
          .eq('judge_id', judgeId);
        
        if (scoresError) throw scoresError;
        setExistingScores(scoresData);
      }
    } catch (error) {
      toast.error('Failed to load event data');
      navigate('/judge');
    } finally {
      setLoading(false);
    }
  };

  const startTimer = () => {
    if (event?.time_limit && timer > 0) {
      setIsTimerRunning(true);
      toast.success('Timer started!');
    }
  };

  const pauseTimer = () => {
    setIsTimerRunning(false);
    toast.info('Timer paused');
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const getScoreForCriteria = (participantId: string, criteriaId: string) => {
    const existing = existingScores.find(s => 
      s.participant_id === participantId && s.criteria_id === criteriaId
    );
    if (existing) return existing.score;
    
    const current = scores.find(s => 
      s.participant_id === participantId && s.criteria_id === criteriaId
    );
    return current?.score || 0;
  };

  const updateScore = (participantId: string, criteriaId: string, score: number) => {
    setScores(prev => {
      const existing = prev.findIndex(s => 
        s.participant_id === participantId && s.criteria_id === criteriaId
      );
      
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { participant_id: participantId, criteria_id: criteriaId, score };
        return updated;
      } else {
        return [...prev, { participant_id: participantId, criteria_id: criteriaId, score }];
      }
    });
  };

  const getCurrentParticipant = () => participants[currentParticipantIndex];

  const nextParticipant = () => {
    if (currentParticipantIndex < participants.length - 1) {
      setCurrentParticipantIndex(prev => prev + 1);
    }
  };

  const previousParticipant = () => {
    if (currentParticipantIndex > 0) {
      setCurrentParticipantIndex(prev => prev - 1);
    }
  };

  const isParticipantScored = (participantId: string) => {
    return criteria.every(c => {
      const existing = existingScores.find(s => 
        s.participant_id === participantId && s.criteria_id === c.id
      );
      if (existing) return true;
      
      const current = scores.find(s => 
        s.participant_id === participantId && s.criteria_id === c.id
      );
      return current && current.score > 0;
    });
  };

  const isParticipantLocked = (participantId: string) => {
    return existingScores.some(s => 
      s.participant_id === participantId && s.is_locked
    );
  };

  const submitScores = async () => {
    if (!judgeId || !eventId) return;
    
    try {
      const scoresToSubmit = scores.map(score => ({
        event_id: eventId,
        judge_id: judgeId,
        participant_id: score.participant_id,
        criteria_id: score.criteria_id,
        score: score.score,
        is_locked: true
      }));

      const { error } = await supabase
        .from('scores')
        .upsert(scoresToSubmit, {
          onConflict: 'event_id,judge_id,participant_id,criteria_id'
        });

      if (error) throw error;
      
      toast.success('Scores submitted successfully!');
      setShowSubmitDialog(false);
      fetchEventData(); // Refresh to get updated locked status
    } catch (error) {
      toast.error('Failed to submit scores');
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

  if (!event || participants.length === 0) {
    return (
      <div className="flex min-h-screen bg-background">
        <div className="w-64 hidden md:block">
          <Navigation />
        </div>
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-muted-foreground mb-4">No participants found for this event</p>
            <Button onClick={() => navigate('/judge')}>Back to Dashboard</Button>
          </div>
        </div>
      </div>
    );
  }

  const currentParticipant = getCurrentParticipant();
  const progress = ((currentParticipantIndex + 1) / participants.length) * 100;
  const isCurrentLocked = isParticipantLocked(currentParticipant.id);

  return (
    <div className="flex min-h-screen bg-background">
      <div className="w-64 hidden md:block">
        <Navigation />
      </div>
      
      <div className="flex-1 pb-16 md:pb-0">
        <div className="p-4 md:p-6">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <h1 className="text-2xl md:text-3xl font-bold text-foreground">
                {event.name}
              </h1>
              <Badge variant={event.status === 'active' ? 'default' : 'secondary'}>
                {event.status}
              </Badge>
            </div>
            <p className="text-muted-foreground">
              Scoring Event • {participants.length} Participants
            </p>
          </div>

          {/* Timer */}
          {event.time_limit && (
            <Card className="mb-6">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-3">
                    <Clock className="h-5 w-5 text-primary" />
                    <span className="text-2xl font-mono">
                      {formatTime(timer)}
                    </span>
                    {timer <= 60 && timer > 0 && (
                      <Badge variant="destructive" className="animate-pulse">
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        Time Running Out!
                      </Badge>
                    )}
                  </div>
                  <div className="flex space-x-2">
                    {!isTimerRunning ? (
                      <Button 
                        onClick={startTimer} 
                        disabled={timer === 0}
                        size="sm"
                      >
                        <Play className="h-4 w-4 mr-1" />
                        Start
                      </Button>
                    ) : (
                      <Button onClick={pauseTimer} variant="outline" size="sm">
                        <Pause className="h-4 w-4 mr-1" />
                        Pause
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Progress */}
          <Card className="mb-6">
            <CardContent className="p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium">
                  Participant {currentParticipantIndex + 1} of {participants.length}
                </span>
                <span className="text-sm text-muted-foreground">
                  {Math.round(progress)}% Complete
                </span>
              </div>
              <Progress value={progress} className="h-2" />
            </CardContent>
          </Card>

          {/* Current Participant */}
          <Card className="mb-6">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center space-x-2">
                    <span>#{currentParticipant.chest_number}</span>
                    <span>{currentParticipant.full_name}</span>
                    {isCurrentLocked && (
                      <Badge variant="secondary">
                        <CheckCircle className="h-3 w-3 mr-1" />
                        Locked
                      </Badge>
                    )}
                  </CardTitle>
                  <CardDescription>
                    {currentParticipant.category} • {currentParticipant.church}
                  </CardDescription>
                </div>
                <div className="flex space-x-2">
                  <Button 
                    onClick={previousParticipant}
                    disabled={currentParticipantIndex === 0}
                    variant="outline"
                    size="sm"
                  >
                    Previous
                  </Button>
                  <Button 
                    onClick={nextParticipant}
                    disabled={currentParticipantIndex === participants.length - 1}
                    variant="outline"
                    size="sm"
                  >
                    Next
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {/* Scoring Criteria */}
              <div className="space-y-6">
                {criteria.map((criterion) => {
                  const currentScore = getScoreForCriteria(currentParticipant.id, criterion.id);
                  const isLocked = existingScores.some(s => 
                    s.participant_id === currentParticipant.id && 
                    s.criteria_id === criterion.id && 
                    s.is_locked
                  );
                  
                  return (
                    <div key={criterion.id} className="space-y-3">
                      <div className="flex justify-between items-center">
                        <div>
                          <h4 className="font-medium">{criterion.name}</h4>
                          <p className="text-sm text-muted-foreground">
                            Max: {criterion.max_score} • Weight: {criterion.weight}x
                          </p>
                        </div>
                        <div className="flex items-center space-x-3">
                          <Input
                            type="number"
                            min="0"
                            max={criterion.max_score}
                            value={currentScore}
                            onChange={(e) => updateScore(
                              currentParticipant.id,
                              criterion.id,
                              parseInt(e.target.value) || 0
                            )}
                            disabled={isLocked}
                            className="w-20 text-center"
                          />
                          <span className="text-sm text-muted-foreground">
                            /{criterion.max_score}
                          </span>
                        </div>
                      </div>
                      
                      <Slider
                        value={[currentScore]}
                        onValueChange={([value]) => updateScore(
                          currentParticipant.id,
                          criterion.id,
                          value
                        )}
                        max={criterion.max_score}
                        min={0}
                        step={1}
                        disabled={isLocked}
                        className="w-full"
                      />
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* Action Buttons */}
          <div className="flex justify-between">
            <Button 
              onClick={() => navigate('/judge')}
              variant="outline"
            >
              Back to Dashboard
            </Button>
            
            <Button 
              onClick={() => setShowSubmitDialog(true)}
              disabled={scores.length === 0}
              className="bg-green-600 hover:bg-green-700"
            >
              <Save className="h-4 w-4 mr-2" />
              Submit Scores
            </Button>
          </div>
        </div>
      </div>

      <div className="md:hidden">
        <Navigation />
      </div>

      {/* Submit Confirmation Dialog */}
      <Dialog open={showSubmitDialog} onOpenChange={setShowSubmitDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Submit Scores</DialogTitle>
            <DialogDescription>
              Are you sure you want to submit your scores? Once submitted, they will be locked and cannot be changed unless unlocked by an admin.
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <div className="text-sm">
              <p className="font-medium mb-2">Scores to submit:</p>
              <ul className="space-y-1 text-muted-foreground">
                {scores.map(score => {
                  const participant = participants.find(p => p.id === score.participant_id);
                  const criterion = criteria.find(c => c.id === score.criteria_id);
                  return (
                    <li key={`${score.participant_id}-${score.criteria_id}`}>
                      {participant?.full_name} - {criterion?.name}: {score.score}/{criterion?.max_score}
                    </li>
                  );
                })}
              </ul>
            </div>
            
            <div className="flex justify-end space-x-2">
              <Button 
                variant="outline" 
                onClick={() => setShowSubmitDialog(false)}
              >
                Cancel
              </Button>
              <Button 
                onClick={submitScores}
                className="bg-green-600 hover:bg-green-700"
              >
                Confirm Submit
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default JudgeScoringInterface;