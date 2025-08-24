import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useParticipantAuth } from '@/hooks/useParticipantAuth';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { usePWA } from '@/hooks/usePWA';
import Navigation from '@/components/Navigation';
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt';
import { Layout, Card, Button, Input, Badge, Modal, Progress, Typography, Space, message, InputNumber, Row, Col, Divider } from 'antd';
import { Clock, Play, Pause, Save, AlertTriangle, CheckCircle, Wifi, WifiOff, Download, Timer, User, Users, Target, Search as SearchIcon, X } from 'lucide-react';
import React from 'react'; // Added missing import for React

const { Content } = Layout;
const { Title, Text } = Typography;
const { Search: SearchInput } = Input;

interface Event {
  id: string;
  name: string;
  type: string;
  event_type: string;
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

interface Group {
  id: string;
  name: string;
  description: string | null;
  members?: Array<{
    participant: {
      full_name: string;
      chest_number: string;
      church: string;
    };
  }>;
}

interface Criteria {
  id: string;
  name: string;
  max_score: number;
  weight: number;
}

interface Score {
  participant_id?: string;
  group_id?: string;
  criteria_id: string;
  score: number;
}

interface ExistingScore {
  id: string;
  participant_id?: string;
  group_id?: string;
  criteria_id: string;
  score: number;
  is_locked: boolean;
}

const JudgeScoringInterface = () => {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const { participant } = useParticipantAuth();
  const { isOnline, syncStatus, unsyncedCount, saveScoreOffline } = useOfflineSync();
  const { isInstallable, installApp } = usePWA();
  
  const [event, setEvent] = useState<Event | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [filteredParticipants, setFilteredParticipants] = useState<Participant[]>([]);
  const [filteredGroups, setFilteredGroups] = useState<Group[]>([]);
  const [criteria, setCriteria] = useState<Criteria[]>([]);
  const [scores, setScores] = useState<Score[]>([]);
  const [existingScores, setExistingScores] = useState<ExistingScore[]>([]);
  const [activeParticipantId, setActiveParticipantId] = useState<string | null>(null);
  const [activeGroupId, setActiveGroupId] = useState<string | null>(null);
  const [timer, setTimer] = useState(0);
  const [isTimerRunning, setIsTimerRunning] = useState(false);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [loading, setLoading] = useState(true);
  const [judgeId, setJudgeId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (participant?.role === 'judge') {
      fetchJudgeId();
    } else if (participant && participant.role === 'participant') {
      message.error('Access denied. Judges only.');
      navigate('/judge');
    }
  }, [participant]);

  useEffect(() => {
    if (judgeId && eventId) {
      fetchEventData();
    }
  }, [judgeId, eventId]);

  useEffect(() => {
    // Filter participants/groups based on search query
    if (searchQuery.trim() === '') {
      setFilteredParticipants(participants);
      setFilteredGroups(groups);
    } else {
      if (event?.event_type === 'individual') {
        const filtered = participants.filter(p => 
          p.chest_number.toLowerCase().includes(searchQuery.toLowerCase())
        );
        setFilteredParticipants(filtered);
      } else {
        const filtered = groups.filter(g => 
          g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          g.members?.some(m => 
            m.participant.chest_number.toLowerCase().includes(searchQuery.toLowerCase())
          )
        );
        setFilteredGroups(filtered);
      }
    }
  }, [searchQuery, participants, groups, event?.event_type]);

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
    if (participant?.id) {
      setJudgeId(participant.id);
    }
  };

  const fetchEventData = async () => {
    try {
      setLoading(true);
      
      // Fetch event details
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .single();

      if (eventError) throw eventError;
      setEvent(eventData);

      if (eventData.event_type === 'individual') {
        // Fetch event participants for individual events
        const { data: eventParticipants, error: participantsError } = await supabase
          .from('event_participants')
          .select(`
            participant:participants(
              id,
              full_name,
              chest_number,
              category,
              church
            )
          `)
          .eq('event_id', eventId);

        if (participantsError) throw participantsError;
        setParticipants(eventParticipants.map(ep => ep.participant));
        setGroups([]);
      } else {
        // Fetch event groups for group events
        const { data: eventGroups, error: groupsError } = await supabase
          .from('event_groups')
          .select(`
            group:groups(
              id,
              name,
              description,
              members:group_members(
                participant:participants(
                  full_name,
                  chest_number,
                  church
                )
              )
            )
          `)
          .eq('event_id', eventId);

        if (groupsError) throw groupsError;
        setGroups(eventGroups.map(eg => eg.group));
        setParticipants([]);
      }

      // Fetch event criteria
      const { data: criteriaData, error: criteriaError } = await supabase
        .from('event_criteria')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at');

      if (criteriaError) throw criteriaError;
      setCriteria(criteriaData);

      // Fetch existing scores
      if (judgeId) {
        const { data: existingScoresData, error: scoresError } = await supabase
          .from('scores')
          .select('*')
          .eq('event_id', eventId)
          .eq('judge_id', judgeId);

        if (scoresError) throw scoresError;

        setExistingScores(existingScoresData || []);
      }
    } catch (error: any) {
      message.error('Failed to load event data: ' + error.message);
    } finally {
      setLoading(false);
    }
  };

  const startScoring = (participantId: string) => {
    // Prevent scoring if participant is already scored
    if (isParticipantScored(participantId)) {
      message.warning('This participant has already been scored');
      return;
    }
    
    setActiveParticipantId(participantId);
    setActiveGroupId(null);
    if (event?.time_limit) {
      setTimer(event.time_limit * 60);
      setIsTimerRunning(true);
    }
  };

  const startGroupScoring = (groupId: string) => {
    // Prevent scoring if group is already scored
    if (isGroupScored(groupId)) {
      message.warning('This group has already been scored');
      return;
    }
    
    setActiveGroupId(groupId);
    setActiveParticipantId(null);
    if (event?.time_limit) {
      setTimer(event.time_limit * 60);
      setIsTimerRunning(true);
    }
  };

  const stopScoring = () => {
    setActiveParticipantId(null);
    setIsTimerRunning(false);
    setTimer(0);
  };

  const resetTimer = () => {
    setIsTimerRunning(false);
    if (event?.time_limit) {
      setTimer(event.time_limit * 60);
    }
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
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

  const updateGroupScore = (groupId: string, criteriaId: string, score: number) => {
    setScores(prev => {
      const existing = prev.findIndex(s => 
        s.group_id === groupId && s.criteria_id === criteriaId
      );
      
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { group_id: groupId, criteria_id: criteriaId, score };
        return updated;
      } else {
        return [...prev, { group_id: groupId, criteria_id: criteriaId, score }];
      }
    });
  };

  const getScoreForCriteria = (participantId: string, criteriaId: string) => {
    const existing = existingScores.find(s => 
      s.participant_id === participantId && s.criteria_id === criteriaId
    );
    if (existing) return existing.score;
    
    const current = scores.find(s => 
      s.participant_id === participantId && s.criteria_id === criteriaId
    );
    return current ? current.score : 0;
  };

  const getGroupScoreForCriteria = (groupId: string, criteriaId: string) => {
    const existing = existingScores.find(s => 
      s.group_id === groupId && s.criteria_id === criteriaId
    );
    if (existing) return existing.score;
    
    const current = scores.find(s => 
      s.group_id === groupId && s.criteria_id === criteriaId
    );
    return current ? current.score : 0;
  };

  const getTotalScoreForParticipant = (participantId: string) => {
    let total = 0;
    criteria.forEach(criterion => {
      const score = getScoreForCriteria(participantId, criterion.id);
      total += score * criterion.weight;
    });
    return total;
  };

  const getTotalScoreForGroup = (groupId: string) => {
    let total = 0;
    criteria.forEach(criterion => {
      const score = getGroupScoreForCriteria(groupId, criterion.id);
      total += score * criterion.weight;
    });
    return total;
  };

  const getMaxPossibleScore = () => {
    return criteria.reduce((total, criterion) => total + (criterion.max_score * criterion.weight), 0);
  };

  const isParticipantScored = (participantId: string) => {
    // Check if participant has scores for ALL criteria in the database
    return criteria.every(c => {
      const existing = existingScores.find(s => 
        s.participant_id === participantId && 
        s.criteria_id === c.id
      );
      return existing !== undefined; // If we found a score in database, participant is scored
    });
  };

  const isGroupScored = (groupId: string) => {
    // Check if group has scores for ALL criteria in the database
    return criteria.every(c => {
      const existing = existingScores.find(s => 
        s.group_id === groupId && 
        s.criteria_id === c.id
      );
      return existing !== undefined; // If we found a score in database, group is scored
    });
  };

  const isParticipantLocked = (participantId: string) => {
    return existingScores.some(s => 
      s.participant_id === participantId && s.is_locked
    );
  };

  const getScoringProgress = () => {
    if (participants.length === 0) return 0;
    
    // Count participants who have scores for ALL criteria in the database
    const scoredParticipants = participants.filter(p => isParticipantScored(p.id));
    return Math.round((scoredParticipants.length / participants.length) * 100);
  };

  const getGroupScoringProgress = () => {
    if (groups.length === 0) return 0;
    
    // Count groups who have scores for ALL criteria in the database
    const scoredGroups = groups.filter(g => isGroupScored(g.id));
    return Math.round((scoredGroups.length / groups.length) * 100);
  };

  const submitParticipantScores = async (participantId: string) => {
    if (!judgeId || !eventId) {
      message.error('Missing judge ID or event ID');
      return;
    }
    
    try {
      // Check if participant is already scored
      if (isParticipantScored(participantId)) {
        message.warning('This participant has already been scored');
        return;
      }

      // Get scores for this specific participant
      const participantScores = scores.filter(s => s.participant_id === participantId);
      
      if (participantScores.length === 0) {
        message.error('No scores to submit for this participant');
        return;
      }



      // Prepare scores for submission
      const scoresToSubmit = participantScores.map(score => ({
        event_id: eventId,
        participant_id: participantId,
        criteria_id: score.criteria_id,
        judge_id: judgeId,
        score: score.score,
        is_locked: true
      }));



      // Insert scores one by one (same approach as group scoring)
      for (const scoreData of scoresToSubmit) {
        const { error: insertError } = await supabase
          .from('scores')
          .insert(scoreData);
        
        if (insertError) {
          console.error('Error inserting score:', scoreData, insertError);
          throw new Error(`Failed to insert score: ${insertError.message}`);
        }
      }
      
      message.success('Scores submitted successfully!');
      
      // Clear local scores for this participant
      setScores(prev => prev.filter(s => s.participant_id !== participantId));
      
      // Refresh data
      await fetchEventData();
      
      // Close scoring interface
      setActiveParticipantId(null);
      stopScoring();
      
    } catch (error) {
      console.error('Score submission error:', error);
      if (error instanceof Error) {
        message.error(`Failed to submit scores: ${error.message}`);
      } else {
        message.error('Failed to submit scores. Please check the console for details.');
      }
    }
  };

  const submitGroupScores = async (groupId: string) => {
    if (!judgeId || !eventId) {
      message.error('Missing judge ID or event ID');
      return;
    }
    
    try {
      // Check if group is already scored
      if (isGroupScored(groupId)) {
        message.warning('This group has already been scored');
        return;
      }

      // Get scores for this specific group
      const groupScores = scores.filter(s => s.group_id === groupId);
      
      if (groupScores.length === 0) {
        message.error('No scores to submit for this group');
        return;
      }



      // Prepare scores for submission
      const scoresToSubmit = groupScores.map(score => ({
        event_id: eventId,
        group_id: groupId,
        criteria_id: score.criteria_id,
        judge_id: judgeId,
        score: score.score,
        is_locked: true
      }));



      // Insert scores one by one
      for (const scoreData of scoresToSubmit) {
        const { error: insertError } = await supabase
          .from('scores')
          .insert(scoreData);
        
        if (insertError) {
          console.error('Error inserting score:', scoreData, insertError);
          throw new Error(`Failed to insert score: ${insertError.message}`);
        }
      }
      
      message.success('Group scores submitted successfully!');
      
      // Clear local scores for this group
      setScores(prev => prev.filter(s => s.group_id !== groupId));
      
      // Refresh data
      await fetchEventData();
      
      // Close scoring interface
      setActiveGroupId(null);
      stopScoring();
      
    } catch (error) {
      console.error('Group score submission error:', error);
      if (error instanceof Error) {
        message.error(`Failed to submit group scores: ${error.message}`);
      } else {
        message.error('Failed to submit group scores. Please check the console for details.');
      }
    }
  };

  if (loading) {
    return (
      <Layout style={{ minHeight: '100vh' }}>
        <Navigation />
        <Layout className="md:ml-64">
          <Content style={{ padding: '12px', paddingBottom: '80px' }} className="md:px-4">
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '400px' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '24px', marginBottom: '16px' }}>Loading...</div>
                <div>Please wait while we load the event data.</div>
              </div>
            </div>
          </Content>
        </Layout>
      </Layout>
    );
  }

  if (!event) {
    return (
      <Layout style={{ minHeight: '100vh' }}>
        <Navigation />
        <Layout className="md:ml-64">
          <Content style={{ padding: '12px', paddingBottom: '80px' }} className="md:px-4">
            <div style={{ textAlign: 'center' }}>
              <Title level={2}>Event Not Found</Title>
              <Text>This event could not be loaded.</Text>
              <br />
              <Button onClick={() => navigate('/judge')} style={{ marginTop: '16px' }}>
                Back to Dashboard
              </Button>
            </div>
          </Content>
        </Layout>
      </Layout>
    );
  }

  // Check if event has participants or groups based on event type
  if (event.event_type === 'individual' && !participants.length) {
    return (
      <Layout style={{ minHeight: '100vh' }}>
        <Navigation />
        <Layout className="md:ml-64">
          <Content style={{ padding: '12px', paddingBottom: '80px' }} className="md:px-4">
            <div style={{ textAlign: 'center' }}>
              <Title level={2}>No Participants</Title>
              <Text>This individual event has no participants assigned.</Text>
              <br />
              <Button onClick={() => navigate('/judge')} style={{ marginTop: '16px' }}>
                Back to Dashboard
              </Button>
            </div>
          </Content>
        </Layout>
      </Layout>
    );
  }

  if (event.event_type === 'group' && !groups.length) {
    return (
      <Layout style={{ minHeight: '100vh' }}>
        <Navigation />
        <Layout className="md:ml-64">
          <Content style={{ padding: '12px', paddingBottom: '80px' }} className="md:px-4">
            <div style={{ textAlign: 'center' }}>
              <Title level={2}>No Groups</Title>
              <Text>This group event has no groups assigned.</Text>
              <br />
              <Button onClick={() => navigate('/judge')} style={{ marginTop: '16px' }}>
                Back to Dashboard
              </Button>
            </div>
          </Content>
        </Layout>
      </Layout>
    );
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Navigation />
      <Layout className="md:ml-64">
        <Content style={{ padding: '12px', paddingBottom: '80px' }} className="md:px-4">
          {/* Header */}
          <div style={{ marginBottom: '24px' }}>
            <div style={{ 
              display: 'flex', 
              flexDirection: 'column',
              gap: '12px',
              marginBottom: '16px'
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '16px',
                flexWrap: 'wrap'
              }}>
                <Title level={2} style={{ 
                  margin: 0, 
                  color: '#111827',
                  fontSize: '28px',
                  fontWeight: 700
                }}>
                  {event.name}
                </Title>
                <div style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  padding: '6px 16px',
                  backgroundColor: event.type === 'stage' ? '#dbeafe' : '#fef3c7',
                  color: event.type === 'stage' ? '#1e40af' : '#92400e',
                  borderRadius: '20px',
                  fontSize: '13px',
                  fontWeight: 600,
                  textTransform: 'uppercase',
                  letterSpacing: '0.5px',
                  border: `1px solid ${event.type === 'stage' ? '#93c5fd' : '#fbbf24'}`
                }}>
                  {event.type}
                </div>
              </div>
              <Text style={{ 
                fontSize: '16px',
                color: '#6b7280',
                fontWeight: 500
              }}>
                Judge Scoring Interface
              </Text>
            </div>
          </div>

          {/* PWA Install Only */}
          {isInstallable && (
            <div style={{ marginBottom: '24px' }}>
              <Button 
                size="small" 
                icon={<Download size={16} />} 
                onClick={installApp}
                style={{ 
                  borderRadius: '8px',
                  height: '36px',
                  fontSize: '13px'
                }}
              >
                Install App
              </Button>
            </div>
          )}

          {/* PWA Install Prompt */}
          <PWAInstallPrompt />

          {/* Overall Progress */}
          <div style={{ 
            marginBottom: '32px',
            padding: '20px',
            backgroundColor: '#f8fafc',
            borderRadius: '16px',
            border: '1px solid #e2e8f0'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <Text strong style={{ fontSize: '17px', color: '#1e293b' }}>
                Scoring Progress
              </Text>
              <Text style={{ fontSize: '15px', color: '#64748b', fontWeight: 500 }}>
                {event?.event_type === 'individual' 
                  ? `${participants.filter(p => isParticipantScored(p.id)).length} of ${participants.length} completed`
                  : `${groups.filter(g => isGroupScored(g.id)).length} of ${groups.length} completed`
                }
              </Text>
            </div>
            <Progress 
              percent={event?.event_type === 'individual' ? getScoringProgress() : getGroupScoringProgress()} 
              showInfo={false}
              strokeColor="#3b82f6"
              trailColor="#cbd5e1"
              strokeWidth={10}
              style={{ margin: 0 }}
            />
          </div>

          {/* Search Bar */}
          <div style={{ marginBottom: '24px' }}>
            <SearchInput
              placeholder={event?.event_type === 'individual' 
                ? `Search by chest no. from ${participants.length} participants`
                : `Search by group name from ${groups.length} groups`
              }
              allowClear
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              prefix={<SearchIcon size={18} color="#6b7280" />}
              style={{ 
                borderRadius: '12px',
                height: '48px',
                fontSize: '15px',
                border: '2px solid #e5e7eb',
                boxShadow: '0 1px 3px 0 rgba(0, 0, 0, 0.1)'
              }}
            />
          </div>

          {/* Participants/Groups Grid with Integrated Scoring Interface */}
          <Row gutter={[12, 12]} style={{ marginBottom: '24px' }}>
            {event?.event_type === 'individual' ? (
              // Individual Participants
              filteredParticipants.map((participant, index) => {
                const isScored = isParticipantScored(participant.id);
                const isLocked = isParticipantLocked(participant.id);
                const totalScore = getTotalScoreForParticipant(participant.id);
                const maxScore = getMaxPossibleScore();
                const scorePercentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;
                const isActive = activeParticipantId === participant.id;
              
              return (
                <React.Fragment key={participant.id}>
                  {/* Participant Card */}
                  <Col xs={24} sm={12} md={8} lg={6}>
                    <Card
                      hoverable
                      style={{ 
                        cursor: 'pointer',
                        borderRadius: '12px',
                        borderColor: isActive ? '#3b82f6' : '#e5e7eb',
                        borderWidth: isActive ? 2 : 1,
                        boxShadow: isActive 
                          ? '0 4px 6px -1px rgba(59, 130, 246, 0.1), 0 2px 4px -1px rgba(59, 130, 246, 0.06)'
                          : '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
                        transition: 'all 0.2s ease-in-out'
                      }}
                      onClick={() => !isLocked && !isScored && startScoring(participant.id)}
                      bodyStyle={{ padding: '16px' }}
                    >
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ 
                          marginBottom: '12px',
                          padding: '12px',
                          backgroundColor: isActive ? '#dbeafe' : '#f1f5f9',
                          borderRadius: '50%',
                          width: '48px',
                          height: '48px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          margin: '0 auto 12px auto'
                        }}>
                          <User size={24} color={isActive ? '#2563eb' : '#64748b'} />
                        </div>
                        
                        <Title level={4} style={{ 
                          margin: 0, 
                          marginBottom: '8px', 
                          color: '#0f172a',
                          fontSize: '20px',
                          fontWeight: 600
                        }}>
                          #{participant.chest_number}
                        </Title>
                        
                        <div style={{ marginBottom: '12px' }}>
                          <Badge 
                            color={isScored ? 'success' : isLocked ? 'default' : 'processing'} 
                            text={isScored ? 'Completed' : isLocked ? 'Submitted' : 'Pending'}
                            style={{ 
                              fontSize: '11px',
                              padding: '2px 8px',
                              borderRadius: '8px',
                              fontWeight: 500
                            }}
                          />
                        </div>
                        
                        {isScored && (
                          <div style={{ 
                            marginBottom: '12px',
                            padding: '8px 16px',
                            backgroundColor: '#ecfdf5',
                            borderRadius: '8px',
                            border: '1px solid #a7f3d0',
                            display: 'inline-block',
                            textAlign: 'center',
                            margin: '0 auto 12px auto'
                          }}>
                            <Text strong style={{ color: '#065f46', fontSize: '12px' }}>
                              {totalScore.toFixed(1)} pts
                            </Text>
                            <Text type="secondary" style={{ fontSize: '10px', display: 'block', color: '#059669' }}>
                              {scorePercentage}%
                            </Text>
                          </div>
                        )}
                        
                        <Button 
                          type={isActive ? 'primary' : 'default'}
                          size="small"
                          disabled={isLocked || isScored}
                          style={{ 
                            borderRadius: '8px',
                            height: '32px',
                            fontSize: '12px',
                            fontWeight: 500,
                            padding: '0 20px',
                            minWidth: '140px',
                            margin: '0 auto',
                            display: 'block'
                          }}
                        >
                          {isActive ? 'Scoring...' : isLocked ? 'Submitted' : isScored ? 'Completed' : 'Start Scoring'}
                        </Button>
                      </div>
                    </Card>
                  </Col>
                  
                  {/* Scoring Interface - Appears immediately below the active participant's card */}
                  {isActive && (
                    <Col xs={24} style={{ marginTop: '16px', marginBottom: '24px' }}>
                      <Card 
                        title={
                          <span style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937' }}>
                            Scoring Participant #{participant.chest_number}
                          </span>
                        }
                        style={{ 
                          borderRadius: '12px',
                          boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                          border: '2px solid #3b82f6'
                        }}
                        extra={
                          <Button 
                            onClick={stopScoring}
                            size="small"
                            icon={<X size={16} />}
                            style={{ borderRadius: '6px' }}
                          >
                            Close
                          </Button>
                        }
                      >
                        <div style={{ padding: '20px 0' }}>
                          {/* Timer Section */}
                          {event.time_limit && (
                            <div style={{ 
                              marginBottom: '24px',
                              padding: '20px',
                              backgroundColor: '#fef3c7',
                              borderRadius: '12px',
                              border: '1px solid #fbbf24'
                            }}>
                              <div style={{ 
                                display: 'flex', 
                                flexDirection: 'column',
                                gap: '20px',
                                alignItems: 'center',
                                textAlign: 'center'
                              }}>
                                <div style={{ 
                                  display: 'flex', 
                                  flexDirection: 'column',
                                  alignItems: 'center',
                                  gap: '8px'
                                }}>
                                  <Clock size={24} color="#d97706" />
                                  <Text strong style={{ fontSize: '16px', color: '#92400e' }}>
                                    Time Remaining
                                  </Text>
                                  <Text style={{ 
                                    fontSize: '32px', 
                                    fontFamily: 'monospace', 
                                    fontWeight: 'bold',
                                    color: timer <= 60 ? '#dc2626' : '#92400e'
                                  }}>
                                    {formatTime(timer)}
                                  </Text>
                                </div>
                                
                                {timer <= 60 && timer > 0 && (
                                  <div style={{ 
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '8px',
                                    padding: '8px 16px',
                                    backgroundColor: '#fee2e2',
                                    borderRadius: '8px',
                                    border: '1px solid #fca5a5'
                                  }}>
                                    <AlertTriangle size={16} color="#dc2626" />
                                    <Text style={{ color: '#dc2626', fontSize: '14px', fontWeight: 500 }}>
                                      Time Running Out!
                                    </Text>
                                  </div>
                                )}
                                
                                <Button 
                                  onClick={resetTimer} 
                                  size="middle"
                                  style={{ 
                                    borderRadius: '8px',
                                    height: '40px',
                                    fontSize: '14px',
                                    fontWeight: 500,
                                    padding: '0 24px'
                                  }}
                                >
                                  Reset Timer
                                </Button>
                              </div>
                            </div>
                          )}


                          
                          {/* Scoring Criteria */}
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            {criteria.map((criterion) => {
                              const currentScore = getScoreForCriteria(participant.id, criterion.id);
                              const isLocked = existingScores.some(s => 
                                s.participant_id === participant.id && 
                                s.criteria_id === criterion.id && 
                                s.is_locked
                              );
                              
                              return (
                                <div key={criterion.id} style={{ 
                                  padding: '20px',
                                  border: '1px solid #e2e8f0',
                                  borderRadius: '12px',
                                  backgroundColor: '#f8fafc'
                                }}>
                                  <div style={{ 
                                    display: 'flex', 
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    gap: '16px'
                                  }}>
                                    <div style={{ flex: 1 }}>
                                      <Text strong style={{ 
                                        display: 'block', 
                                        fontSize: '16px',
                                        color: '#1e293b',
                                        marginBottom: '6px'
                                      }}>
                                        {criterion.name}
                                      </Text>
                                      <Text type="secondary" style={{ fontSize: '13px', color: '#64748b' }}>
                                        Max: {criterion.max_score}
                                      </Text>
                                    </div>
                                    <div style={{ 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      gap: '12px',
                                      flexShrink: 0
                                    }}>
                                      <InputNumber
                                        min={0}
                                        max={criterion.max_score}
                                        step={0.1}
                                        precision={1}
                                        value={currentScore}
                                        onChange={(value) => updateScore(
                                          participant.id,
                                          criterion.id,
                                          value || 0
                                        )}
                                        disabled={isLocked}
                                        style={{ 
                                          width: '120px',
                                          height: '40px',
                                          borderRadius: '8px',
                                          border: '1px solid #d1d5db',
                                          textAlign: 'center'
                                        }}
                                        placeholder="0.0"
                                      />
                                      <Text type="secondary" style={{ fontSize: '14px', fontWeight: 500, color: '#6b7280', minWidth: '40px' }}>
                                        /{criterion.max_score}
                                      </Text>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          
                          {/* Total Score Display */}
                          <div style={{ 
                            marginTop: '32px', 
                            padding: '24px', 
                            backgroundColor: '#f0fdf4', 
                            borderRadius: '16px',
                            border: '2px solid #22c55e',
                            textAlign: 'center'
                          }}>
                            <Text strong style={{ fontSize: '18px', color: '#166534', marginBottom: '8px', display: 'block' }}>
                              Total Score
                            </Text>
                            <Text strong style={{ fontSize: '32px', color: '#166534', marginBottom: '12px', display: 'block' }}>
                              {getTotalScoreForParticipant(participant.id).toFixed(1)} / {getMaxPossibleScore().toFixed(1)}
                            </Text>
                            <Text type="secondary" style={{ fontSize: '14px', color: '#059669' }}>
                              {Math.round((getTotalScoreForParticipant(participant.id) / getMaxPossibleScore()) * 100)}% of maximum possible score
                            </Text>
                          </div>

                          {/* Submit Button */}
                          <div style={{ 
                            marginTop: '32px',
                            textAlign: 'center'
                          }}>
                            <Button 
                              type="primary"
                              size="large"
                              icon={<Save size={20} />}
                              onClick={() => submitParticipantScores(participant.id)}
                              disabled={!criteria.every(c => {
                                const score = getScoreForCriteria(participant.id, c.id);
                                return score > 0;
                              })}
                              style={{ 
                                backgroundColor: '#22c55e',
                                borderColor: '#22c55e',
                                borderRadius: '12px',
                                height: '48px',
                                padding: '0 32px',
                                fontSize: '16px',
                                fontWeight: 600,
                                color: 'white'
                              }}
                            >
                              Submit Scores
                            </Button>
                          </div>
                        </div>
                      </Card>
                    </Col>
                  )}
                </React.Fragment>
              );
            })
            ) : (
              // Group Events
              filteredGroups.map((group, index) => {
                const isScored = isGroupScored(group.id);
                const isActive = activeGroupId === group.id;
                
                return (
                  <React.Fragment key={group.id}>
                    {/* Group Card */}
                    <Col xs={24} sm={12} md={8} lg={6}>
                      <Card
                        hoverable
                        style={{ 
                          cursor: 'pointer',
                          borderRadius: '12px',
                          borderColor: isActive ? '#3b82f6' : '#e5e7eb',
                          borderWidth: isActive ? 2 : 1,
                          boxShadow: isActive 
                            ? '0 4px 6px -1px rgba(59, 130, 246, 0.1), 0 2px 4px -1px rgba(59, 130, 246, 0.06)'
                            : '0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06)',
                          transition: 'all 0.2s ease-in-out'
                        }}
                        onClick={() => !isScored && startGroupScoring(group.id)}
                        bodyStyle={{ padding: '16px' }}
                      >
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ 
                            marginBottom: '12px',
                            padding: '12px',
                            backgroundColor: isActive ? '#dbeafe' : '#f1f5f9',
                            borderRadius: '50%',
                            width: '48px',
                            height: '48px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 12px auto'
                          }}>
                            <Users size={24} color={isActive ? '#2563eb' : '#64748b'} />
                          </div>
                          
                          <Title level={4} style={{ 
                            margin: 0, 
                            marginBottom: '8px', 
                            color: '#0f172a',
                            fontSize: '18px',
                            fontWeight: 600
                          }}>
                            {group.name}
                          </Title>
                          
                          <div style={{ marginBottom: '8px' }}>
                            <Text type="secondary" style={{ fontSize: '12px', color: '#64748b' }}>
                              {group.members?.length || 0} members
                            </Text>
                          </div>
                          
                          <div style={{ marginBottom: '12px' }}>
                            <Badge 
                              color={isScored ? 'success' : 'processing'} 
                              text={isScored ? 'Completed' : 'Pending'}
                              style={{ 
                                fontSize: '11px',
                                padding: '2px 8px',
                                borderRadius: '8px',
                                fontWeight: 500
                              }}
                            />
                          </div>
                          
                          <Button 
                            type={isActive ? 'primary' : 'default'}
                            size="small"
                            disabled={isScored}
                            style={{ 
                              borderRadius: '8px',
                              height: '32px',
                              fontSize: '12px',
                              fontWeight: 500,
                              padding: '0 20px',
                              minWidth: '140px',
                              margin: '0 auto',
                              display: 'block'
                            }}
                          >
                            {isActive ? 'Scoring...' : isScored ? 'Completed' : 'Start Scoring'}
                          </Button>
                        </div>
                      </Card>
                    </Col>
                    
                    {/* Scoring Interface for Groups */}
                    {isActive && (
                      <Col xs={24} style={{ marginTop: '16px', marginBottom: '24px' }}>
                        <Card 
                          title={
                            <span style={{ fontSize: '18px', fontWeight: 600, color: '#1f2937' }}>
                              Scoring Group: {group.name}
                            </span>
                          }
                          style={{ 
                            borderRadius: '12px',
                            boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)',
                            border: '2px solid #3b82f6'
                          }}
                          extra={
                            <Button 
                              onClick={stopScoring}
                              size="small"
                              icon={<X size={16} />}
                              style={{ borderRadius: '6px' }}
                            >
                              Close
                            </Button>
                          }
                        >
                          <div style={{ padding: '20px 0' }}>
                            {/* Timer Section */}
                            {event?.time_limit && (
                              <div style={{ 
                                marginBottom: '24px',
                                padding: '16px',
                                backgroundColor: '#fef3c7',
                                borderRadius: '12px',
                                border: '1px solid #f59e0b',
                                textAlign: 'center'
                              }}>
                                <div style={{ marginBottom: '8px' }}>
                                  <Text strong style={{ fontSize: '16px', color: '#92400e' }}>
                                    Time Remaining
                                  </Text>
                                </div>
                                <div style={{ 
                                  fontSize: '24px', 
                                  fontWeight: 'bold', 
                                  color: '#92400e',
                                  marginBottom: '8px'
                                }}>
                                  {Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, '0')}
                                </div>
                                <div style={{ marginBottom: '12px' }}>
                                  <Button 
                                    size="small"
                                    onClick={() => {
                                      if (event?.time_limit) {
                                        setTimer(event.time_limit * 60);
                                        setIsTimerRunning(true);
                                      }
                                    }}
                                    style={{ 
                                      borderRadius: '6px',
                                      fontSize: '12px',
                                      height: '28px',
                                      padding: '0 12px'
                                    }}
                                  >
                                    Reset Timer
                                  </Button>
                                </div>
                                {timer <= 30 && (
                                  <div style={{ 
                                    color: '#dc2626', 
                                    fontSize: '12px', 
                                    fontWeight: 'bold',
                                    backgroundColor: '#fef2f2',
                                    padding: '4px 8px',
                                    borderRadius: '6px',
                                    border: '1px solid #fecaca'
                                  }}>
                                    ⚠️ Time Running Out!
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Group Members Display */}
                            <div style={{ marginBottom: '24px' }}>
                              <Text strong style={{ fontSize: '16px', color: '#374151', marginBottom: '12px', display: 'block' }}>
                                Group Members
                              </Text>
                              <div style={{ 
                                padding: '16px',
                                backgroundColor: '#f8fafc',
                                borderRadius: '8px',
                                border: '1px solid #e2e8f0'
                              }}>
                                {group.members?.map((member, idx) => (
                                  <div key={idx} style={{ 
                                    display: 'flex', 
                                    justifyContent: 'space-between', 
                                    alignItems: 'center',
                                    padding: '8px 0',
                                    borderBottom: idx < (group.members?.length || 0) - 1 ? '1px solid #e2e8f0' : 'none'
                                  }}>
                                    <span style={{ fontWeight: 500 }}>{member.participant.full_name}</span>
                                    <span style={{ fontSize: '12px', color: '#64748b' }}>
                                      #{member.participant.chest_number} • {member.participant.church}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Scoring Criteria */}
                            <div style={{ marginBottom: '24px' }}>
                              <Text strong style={{ fontSize: '16px', color: '#374151', marginBottom: '16px', display: 'block' }}>
                                Scoring Criteria
                              </Text>
                              <div style={{ display: 'grid', gap: '16px' }}>
                                {criteria.map((criterion, index) => {
                                  const currentScore = getGroupScoreForCriteria(group.id, criterion.id);
                                  
                                  return (
                                    <div key={criterion.id} style={{ 
                                      padding: '16px',
                                      backgroundColor: '#f8fafc',
                                      borderRadius: '8px',
                                      border: '1px solid #e2e8f0'
                                    }}>
                                      <div style={{ 
                                        display: 'flex', 
                                        justifyContent: 'space-between', 
                                        alignItems: 'center',
                                        marginBottom: '12px'
                                      }}>
                                        <Text strong style={{ fontSize: '15px', color: '#1f2937' }}>
                                          {criterion.name}
                                        </Text>
                                        <Text type="secondary" style={{ fontSize: '13px', color: '#6b7280' }}>
                                          Max: {criterion.max_score}
                                        </Text>
                                      </div>
                                      
                                      <div style={{ 
                                        display: 'flex', 
                                        alignItems: 'center', 
                                        gap: '12px'
                                      }}>
                                        <InputNumber
                                          value={currentScore}
                                          onChange={(value) => updateGroupScore(group.id, criterion.id, value || 0)}
                                          min={0}
                                          max={criterion.max_score}
                                          step={0.1}
                                          style={{ 
                                            width: '120px',
                                            borderRadius: '8px',
                                            border: '1px solid #d1d5db',
                                            textAlign: 'center'
                                          }}
                                          placeholder="0.0"
                                        />
                                        <Text type="secondary" style={{ fontSize: '14px', fontWeight: 500, color: '#6b7280', minWidth: '40px' }}>
                                          /{criterion.max_score}
                                        </Text>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                            
                            {/* Total Score Display */}
                            <div style={{ 
                              marginTop: '32px', 
                              padding: '24px', 
                              backgroundColor: '#f0fdf4', 
                              borderRadius: '16px',
                              border: '2px solid #22c55e',
                              textAlign: 'center'
                            }}>
                              <Text strong style={{ fontSize: '18px', color: '#166534', marginBottom: '8px', display: 'block' }}>
                                Total Score
                              </Text>
                              <Text strong style={{ fontSize: '32px', color: '#166534', marginBottom: '12px', display: 'block' }}>
                                {getTotalScoreForGroup(group.id).toFixed(1)} / {getMaxPossibleScore().toFixed(1)}
                              </Text>
                              <Text type="secondary" style={{ fontSize: '14px', color: '#059669' }}>
                                {Math.round((getTotalScoreForGroup(group.id) / getMaxPossibleScore()) * 100)}% of maximum possible score
                              </Text>
                            </div>

                            {/* Submit Button */}
                            <div style={{ 
                              marginTop: '32px',
                              textAlign: 'center'
                            }}>
                              <Button 
                                type="primary"
                                size="large"
                                icon={<Save size={20} />}
                                onClick={() => submitGroupScores(group.id)}
                                disabled={!criteria.every(c => {
                                  const score = getGroupScoreForCriteria(group.id, c.id);
                                  return score > 0;
                                })}
                                style={{ 
                                  backgroundColor: '#22c55e',
                                  borderColor: '#22c55e',
                                  borderRadius: '12px',
                                  height: '48px',
                                  padding: '0 32px',
                                  fontSize: '16px',
                                  fontWeight: 600,
                                  color: 'white'
                                }}
                              >
                                Submit Scores
                              </Button>
                            </div>
                          </div>
                        </Card>
                      </Col>
                    )}
                  </React.Fragment>
                );
              })
            )}
          </Row>

          {/* Action Buttons */}
          <div style={{ 
            display: 'flex', 
            justifyContent: 'space-between',
            padding: '24px 0',
            borderTop: '1px solid #e5e7eb'
          }}>
            <Button 
              onClick={() => navigate('/judge')}
              size="large"
              style={{ 
                borderRadius: '8px',
                height: '44px',
                padding: '0 24px'
              }}
            >
              Back to Dashboard
            </Button>
            
            <div></div>
          </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default JudgeScoringInterface;