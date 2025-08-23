import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { usePWA } from '@/hooks/usePWA';
import Navigation from '@/components/Navigation';
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt';
import { Layout, Card, Button, Input, Badge, Slider, Modal, Progress, Typography, Space, message, InputNumber } from 'antd';
import { Clock, Play, Pause, Save, AlertTriangle, CheckCircle, Wifi, WifiOff, Download } from 'lucide-react';

const { Content } = Layout;
const { Title, Text } = Typography;

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
  const { isOnline, syncStatus, unsyncedCount, saveScoreOffline } = useOfflineSync();
  const { isInstallable, installApp } = usePWA();
  
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
            message.warning("Time's up!");
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [isTimerRunning, timer]);

  const fetchJudgeId = async () => {
    // Since judges now use separate authentication like participants,
    // the judge ID will need to be passed from the login process
    // For now, we'll need to implement judge authentication through the participant-auth edge function
    console.log('Judge authentication needs to be implemented through participant-auth system');
    // Temporary: navigate back since this needs proper authentication
    navigate('/judge');
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
      message.error('Failed to load event data');
      navigate('/judge');
    } finally {
      setLoading(false);
    }
  };

  const startTimer = () => {
    if (event?.time_limit && timer > 0) {
      setIsTimerRunning(true);
      message.success('Timer started!');
    }
  };

  const pauseTimer = () => {
    setIsTimerRunning(false);
    message.info('Timer paused');
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
      if (isOnline) {
        // Submit scores normally when online
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
        
        message.success('Scores submitted successfully!');
      } else {
        // Save scores offline when offline
        const scoresByParticipant = scores.reduce((acc, score) => {
          if (!acc[score.participant_id]) {
            acc[score.participant_id] = {};
          }
          acc[score.participant_id][score.criteria_id] = score.score;
          return acc;
        }, {} as Record<string, Record<string, number>>);

        // Save each participant's scores offline
        for (const [participantId, participantScores] of Object.entries(scoresByParticipant)) {
          await saveScoreOffline(eventId, participantId, judgeId, participantScores);
        }
        
        message.success('Scores saved offline and will sync when online!');
      }
      
      setShowSubmitDialog(false);
      fetchEventData(); // Refresh to get updated locked status
    } catch (error) {
      message.error('Failed to submit scores');
    }
  };

  if (loading) {
    return (
      <Layout style={{ minHeight: '100vh' }}>
        <Navigation />
        <Layout className="md:ml-64">
          <Content style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="md:px-6">
            <div style={{ textAlign: 'center' }}>Loading...</div>
          </Content>
        </Layout>
      </Layout>
    );
  }

  if (!event || participants.length === 0) {
    return (
      <Layout style={{ minHeight: '100vh' }}>
        <Navigation />
        <Layout className="md:ml-64">
          <Content style={{ padding: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center' }} className="md:px-6">
            <div style={{ textAlign: 'center' }}>
              <Text type="secondary" style={{ display: 'block', marginBottom: '16px' }}>
                No participants found for this event
              </Text>
              <Button onClick={() => navigate('/judge')}>Back to Dashboard</Button>
            </div>
          </Content>
        </Layout>
      </Layout>
    );
  }

  const currentParticipant = getCurrentParticipant();
  const progress = ((currentParticipantIndex + 1) / participants.length) * 100;
  const isCurrentLocked = isParticipantLocked(currentParticipant.id);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Navigation />
      <Layout className="md:ml-64">
        <Content style={{ padding: '16px' }} className="md:px-6">
          {/* Header */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <div>
                <Title level={2} style={{ margin: 0, marginBottom: '4px' }}>
                  {event.name}
                </Title>
                <Text type="secondary">
                  Scoring Event • {participants.length} Participants
                </Text>
              </div>
              <Space>
                <Badge color={event.status === 'active' ? 'green' : 'default'}>
                  {event.status}
                </Badge>
                
                {/* Network Status */}
                <Space size={4}>
                  {isOnline ? (
                    <Wifi size={16} color="green" />
                  ) : (
                    <WifiOff size={16} color="red" />
                  )}
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    {isOnline ? 'Online' : 'Offline'}
                  </Text>
                </Space>
                
                {/* Unsynced count */}
                {unsyncedCount > 0 && (
                  <Badge count={unsyncedCount} style={{ backgroundColor: 'orange' }}>
                    <Text style={{ fontSize: '12px' }}>unsynced</Text>
                  </Badge>
                )}
                
                {/* PWA Install */}
                {isInstallable && (
                  <Button
                    size="small"
                    onClick={installApp}
                    icon={<Download size={16} />}
                  >
                    Install
                  </Button>
                )}
              </Space>
            </div>
          </div>

          {/* PWA Install Prompt */}
          <PWAInstallPrompt />

          {/* Timer */}
          {event.time_limit && (
            <Card style={{ marginBottom: '24px' }}>
              <div style={{ padding: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <Space size={12}>
                    <Clock size={20} color="#1890ff" />
                    <Text style={{ fontSize: '24px', fontFamily: 'monospace' }}>
                      {formatTime(timer)}
                    </Text>
                    {timer <= 60 && timer > 0 && (
                      <Badge color="red" style={{ animation: 'pulse 1s infinite' }}>
                        <AlertTriangle size={12} style={{ marginRight: '4px' }} />
                        Time Running Out!
                      </Badge>
                    )}
                  </Space>
                  <Space>
                    {!isTimerRunning ? (
                      <Button 
                        onClick={startTimer} 
                        disabled={timer === 0}
                        size="small"
                        icon={<Play size={16} />}
                      >
                        Start
                      </Button>
                    ) : (
                      <Button 
                        onClick={pauseTimer} 
                        size="small"
                        icon={<Pause size={16} />}
                      >
                        Pause
                      </Button>
                    )}
                  </Space>
                </div>
              </div>
            </Card>
          )}

          {/* Progress */}
          <Card style={{ marginBottom: '24px' }}>
            <div style={{ padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <Text strong style={{ fontSize: '14px' }}>
                  Participant {currentParticipantIndex + 1} of {participants.length}
                </Text>
                <Text type="secondary" style={{ fontSize: '14px' }}>
                  {Math.round(progress)}% Complete
                </Text>
              </div>
              <Progress percent={progress} showInfo={false} />
            </div>
          </Card>

          {/* Current Participant */}
          <Card style={{ marginBottom: '24px' }}>
            <div style={{ padding: '24px 24px 0 24px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <Title level={4} style={{ margin: 0, marginBottom: '4px' }}>
                    <Space>
                      <span>#{currentParticipant.chest_number}</span>
                      <span>{currentParticipant.full_name}</span>
                      {isCurrentLocked && (
                        <Badge color="default">
                          <CheckCircle size={12} style={{ marginRight: '4px' }} />
                          Locked
                        </Badge>
                      )}
                    </Space>
                  </Title>
                  <Text type="secondary">
                    {currentParticipant.category} • {currentParticipant.church}
                  </Text>
                </div>
                <Space>
                  <Button 
                    onClick={previousParticipant}
                    disabled={currentParticipantIndex === 0}
                    size="small"
                  >
                    Previous
                  </Button>
                  <Button 
                    onClick={nextParticipant}
                    disabled={currentParticipantIndex === participants.length - 1}
                    size="small"
                  >
                    Next
                  </Button>
                </Space>
              </div>
            </div>
            <div style={{ padding: '24px' }}>
              {/* Scoring Criteria */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                {criteria.map((criterion) => {
                  const currentScore = getScoreForCriteria(currentParticipant.id, criterion.id);
                  const isLocked = existingScores.some(s => 
                    s.participant_id === currentParticipant.id && 
                    s.criteria_id === criterion.id && 
                    s.is_locked
                  );
                  
                  return (
                    <div key={criterion.id} style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          <Text strong style={{ display: 'block' }}>{criterion.name}</Text>
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            Max: {criterion.max_score} • Weight: {criterion.weight}x
                          </Text>
                        </div>
                        <Space>
                          <InputNumber
                            min={0}
                            max={criterion.max_score}
                            value={currentScore}
                            onChange={(value) => updateScore(
                              currentParticipant.id,
                              criterion.id,
                              value || 0
                            )}
                            disabled={isLocked}
                            style={{ width: '80px' }}
                          />
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            /{criterion.max_score}
                          </Text>
                        </Space>
                      </div>
                      
                      <Slider
                        value={currentScore}
                        onChange={(value) => updateScore(
                          currentParticipant.id,
                          criterion.id,
                          value
                        )}
                        max={criterion.max_score}
                        min={0}
                        step={1}
                        disabled={isLocked}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>

          {/* Action Buttons */}
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <Button onClick={() => navigate('/judge')}>
              Back to Dashboard
            </Button>
            
            <Button 
              onClick={() => setShowSubmitDialog(true)}
              disabled={scores.length === 0}
              type="primary"
              icon={<Save size={16} />}
              style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
            >
              Submit Scores
            </Button>
          </div>
        </Content>
      </Layout>

      {/* Submit Confirmation Dialog */}
      <Modal
        title="Submit Scores"
        open={showSubmitDialog}
        onCancel={() => setShowSubmitDialog(false)}
        footer={[
          <Button key="cancel" onClick={() => setShowSubmitDialog(false)}>
            Cancel
          </Button>,
          <Button 
            key="submit" 
            type="primary"
            onClick={submitScores}
            style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
          >
            Confirm Submit
          </Button>
        ]}
      >
        <div style={{ marginBottom: '16px' }}>
          <Text>
            Are you sure you want to submit your scores? Once submitted, they will be locked and cannot be changed unless unlocked by an admin.
          </Text>
        </div>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <Text strong style={{ display: 'block', marginBottom: '8px' }}>Scores to submit:</Text>
            <ul style={{ listStyle: 'none', padding: 0, display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {scores.map(score => {
                const participant = participants.find(p => p.id === score.participant_id);
                const criterion = criteria.find(c => c.id === score.criteria_id);
                return (
                  <li key={`${score.participant_id}-${score.criteria_id}`}>
                    <Text type="secondary" style={{ fontSize: '14px' }}>
                      {participant?.full_name} - {criterion?.name}: {score.score}/{criterion?.max_score}
                    </Text>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </Modal>
    </Layout>
  );
};

export default JudgeScoringInterface;