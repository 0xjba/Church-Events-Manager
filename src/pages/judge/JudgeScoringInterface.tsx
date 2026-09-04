import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useParticipantAuth } from '@/hooks/useParticipantAuth';
import { scoreSubmissionService } from '@/utils/scoreSubmission';
import { usePWA } from '@/hooks/usePWA';
import Navigation from '@/components/Navigation';

import { Layout, Card, Button, Input, Badge, Modal, Progress, Typography, Space, message, InputNumber, Row, Col, Divider, Slider } from 'antd';
import { Clock, Play, Pause, Save, AlertTriangle, CheckCircle, Wifi, WifiOff, Download, Timer, User, Users, Target, Search as SearchIcon, X, ArrowLeft } from 'lucide-react';
import React from 'react'; // Added missing import for React

// Add custom CSS for improved slider interaction
const sliderStyles = `
  .ant-slider-rail {
    cursor: pointer !important;
    height: 8px !important;
  }
  
  .ant-slider-track {
    cursor: pointer !important;
    height: 8px !important;
  }
  
  .ant-slider-handle {
    cursor: grab !important;
    touch-action: none !important;
    width: 20px !important;
    height: 20px !important;
    margin-top: -6px !important;
    border-width: 3px !important;
    border-radius: 50% !important;
    outline: none !important;
    box-shadow: none !important;
    background: #fff !important;
    border-color: #8b5cf6 !important;
  }
  
  .ant-slider-handle:focus {
    outline: none !important;
    box-shadow: none !important;
  }
  
  .ant-slider-handle:focus-visible {
    outline: none !important;
    box-shadow: none !important;
  }
  
  .ant-slider-handle::before {
    display: none !important;
  }
  
  .ant-slider-handle::after {
    display: none !important;
  }
  
  .ant-slider-handle:active {
    cursor: grabbing !important;
  }
  
  .ant-slider:hover .ant-slider-rail {
    background-color: #d9d9d9 !important;
  }
  
  .ant-slider:hover .ant-slider-track {
    background-color: #8b5cf6 !important;
  }
  
  .ant-slider {
    height: 20px !important;
  }
`;

// Inject the styles
if (typeof document !== 'undefined') {
  const styleSheet = document.createElement('style');
  styleSheet.textContent = sliderStyles;
  document.head.appendChild(styleSheet);
}

const { Content } = Layout;
const { Title, Text } = Typography;

// Custom Slider wrapper that handles track clicks and touch events
const ClickableSlider = ({ 
  min, 
  max, 
  value, 
  onChange, 
  onAfterChange, 
  disabled, 
  tooltip, 
  style, 
  trackStyle, 
  handleStyle, 
  railStyle,
  step = 0.1
}: any) => {
  const calculateValue = (clientX: number, rect: DOMRect) => {
    const percent = (clientX - rect.left) / rect.width;
    const newValue = min + (max - min) * percent;
    const steppedValue = Math.round(newValue / step) * step;
    return Math.max(min, Math.min(max, steppedValue));
  };

  const handleTrackClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (disabled) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const newValue = calculateValue(e.clientX, rect);
    
    onChange?.(newValue);
    onAfterChange?.(newValue);
  };

  const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
    if (disabled) return;
    
    const rect = e.currentTarget.getBoundingClientRect();
    const touch = e.touches[0];
    const newValue = calculateValue(touch.clientX, rect);
    
    onChange?.(newValue);
    onAfterChange?.(newValue);
  };

  return (
    <div 
      onClick={handleTrackClick} 
      onTouchStart={handleTouchStart}
      style={{ cursor: 'pointer', touchAction: 'none' }}
    >
      <Slider
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={onChange}
        onAfterChange={onAfterChange}
        disabled={disabled}
        tooltip={tooltip}
        style={style}
        trackStyle={trackStyle}
        handleStyle={handleStyle}
        railStyle={railStyle}
      />
    </div>
  );
};

interface Event {
  id: string;
  name: string;
  type: string;
  event_type: string;
  time_limit: number | null;
  status: string;
  age_category: string | null;
}

interface Participant {
  id: string;
  full_name: string;
  chest_number: string;
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
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingScoresCount, setPendingScoresCount] = useState(0);
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

  // Monitor network status and pending scores
  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      message.success('Back Online - Pending scores will be submitted');
    };

    const handleOffline = () => {
      setIsOnline(false);
      message.info('Offline - Scores will be cached until connection is restored');
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const unsubscribe = scoreSubmissionService.onPendingChange(setPendingScoresCount);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      unsubscribe();
    };
  }, []);

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
        // The scores table is closed to clients; the edge function checks the
        // judge's token and returns only that judge's rows.
        const token = localStorage.getItem('participant_token');
        const { data: mine, error: scoresError } = await supabase.functions.invoke('scores/mine', {
          body: { event_id: eventId },
          headers: { Authorization: `Bearer ${token}` },
        });

        if (scoresError) throw scoresError;
        if (mine?.error) throw new Error(mine.error);

        setExistingScores(mine?.scores || []);
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
    // An event with no criteria cannot have been scored; criteria.every()
    // would otherwise return true for everyone and block all scoring.
    if (criteria.length === 0) return false;

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
    if (criteria.length === 0) return false;

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

      // Every criterion has to be scored: a partial sheet would later be
      // averaged against complete ones, and an untouched field is not a zero.
      const missing = criteria.filter(c => !participantScores.some(s => s.criteria_id === c.id));
      if (missing.length > 0) {
        message.error(`Score every criterion before submitting. Missing: ${missing.map(c => c.name).join(', ')}`);
        return;
      }

      const delivered = await scoreSubmissionService.submitScoresheet({
        eventId,
        participantId,
        scores: participantScores.map(s => ({ criteria_id: s.criteria_id, score: s.score })),
      });

      message.success(delivered ? 'Scores submitted successfully!' : 'Scores saved on this device - will submit when online');
      
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

      const missing = criteria.filter(c => !groupScores.some(s => s.criteria_id === c.id));
      if (missing.length > 0) {
        message.error(`Score every criterion before submitting. Missing: ${missing.map(c => c.name).join(', ')}`);
        return;
      }

      const delivered = await scoreSubmissionService.submitScoresheet({
        eventId,
        groupId,
        scores: groupScores.map(s => ({ criteria_id: s.criteria_id, score: s.score })),
      });

      message.success(delivered ? 'Group scores submitted successfully!' : 'Group scores saved on this device - will submit when online');
      
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
          <Content style={{ padding: '12px', paddingBottom: '80px', paddingTop: '80px' }} className="md:px-4 md:pt-4">
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
          <Content style={{ padding: '12px', paddingBottom: '80px', paddingTop: '80px' }} className="md:px-4 md:pt-4">
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
          <Content style={{ padding: '12px', paddingBottom: '80px', paddingTop: '80px' }} className="md:px-4 md:pt-4">
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
          <Content style={{ padding: '12px', paddingBottom: '80px', paddingTop: '80px' }} className="md:px-4 md:pt-4">
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
        <Content style={{ padding: '12px', paddingBottom: '80px', paddingTop: '80px' }} className="md:px-4 md:pt-4">
          {/* Header */}
          <div style={{ marginBottom: '24px' }}>
            <Button 
              icon={<ArrowLeft size={16} />} 
              onClick={() => navigate('/judge')}
              style={{ marginBottom: '16px' }}
            >
              Back to All Events
            </Button>
            
            <div style={{ marginBottom: '8px' }}>
              <Title level={2} style={{ 
                margin: 0, 
                color: '#111827',
                fontSize: '28px',
                fontWeight: 700
              }}>
                {event.name}
              </Title>
              <Text type="secondary" style={{ fontSize: '16px', marginTop: '4px', display: 'block', fontWeight: 500 }}>
                {event.age_category || 'All Categories'}
              </Text>
              <Text type="secondary" style={{ fontSize: '14px', marginTop: '4px', display: 'block' }}>
                {event?.event_type === 'individual' 
                  ? `${participants.filter(p => isParticipantScored(p.id)).length} of ${participants.length} participants completed`
                  : `${groups.filter(g => isGroupScored(g.id)).length} of ${groups.length} groups completed`
                }
              </Text>
            </div>
          </div>





          {/* Search Bar */}
          <div style={{ marginBottom: '24px' }}>
            <Input
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
                border: '2px solid #e5e7eb'
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
                  <Col xs={12} sm={8} md={6} lg={4}>
                    <Card
                      hoverable
                      style={{ 
                        cursor: 'pointer',
                        borderColor: isActive ? '#8c8c8c' : undefined,
                        borderWidth: isActive ? 2 : 1,
                        boxShadow: isActive ? '0 2px 8px rgba(0, 0, 0, 0.1)' : undefined
                      }}
                      onClick={() => !isLocked && !isScored && startScoring(participant.id)}
                      bodyStyle={{ padding: '12px' }}
                    >
                      <div style={{ textAlign: 'center' }}>
                        <div style={{ 
                          marginBottom: '8px',
                          padding: '8px',
                          backgroundColor: '#f5f5f5',
                          borderRadius: '50%',
                          width: '36px',
                          height: '36px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          margin: '0 auto 8px auto'
                        }}>
                          <User size={18} color="#666" />
                        </div>
                        
                        <Title level={4} style={{ 
                          margin: 0, 
                          marginBottom: '8px'
                        }}>
                          #{participant.chest_number}
                        </Title>
                        
                        <div style={{ marginBottom: '12px' }}>
                          <Badge 
                            color={isScored ? 'success' : isLocked ? 'default' : 'processing'} 
                            text={isScored ? 'Completed' : isLocked ? 'Submitted' : 'Pending'}
                          />
                        </div>
                        
                        {isScored && (
                          <div style={{ 
                            marginBottom: '8px',
                            padding: '4px 8px',
                            backgroundColor: '#f5f5f5',
                            borderRadius: '4px',
                            border: '1px solid #d9d9d9',
                            display: 'inline-block',
                            textAlign: 'center',
                            margin: '0 auto 8px auto'
                          }}>
                            <Text style={{ fontSize: '11px', color: '#666' }}>
                              {totalScore.toFixed(1)} pts ({scorePercentage}%)
                            </Text>
                          </div>
                        )}
                        
                        <Button 
                          type={isActive ? 'primary' : 'default'}
                          size="middle"
                          disabled={isLocked || isScored}
                          style={{ 
                            minWidth: '120px',
                            height: '32px',
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
                        title={`Scoring Participant #${participant.chest_number}`}
                        extra={
                          <Button 
                            onClick={stopScoring}
                            size="small"
                            icon={<X size={14} color="#ff4d4f" />}
                            style={{
                              width: '32px',
                              height: '32px',
                              borderRadius: '6px',
                              backgroundColor: 'white',
                              borderColor: '#d9d9d9',
                              color: '#ff4d4f',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}
                          />
                        }
                      >
                        <div style={{ padding: '20px 0' }}>
                          {/* Timer Section */}
                          {event.time_limit && (
                            <div style={{ 
                              marginBottom: '16px',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'space-between',
                              padding: '12px 0'
                            }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                <Clock size={16} color="#fa8c16" />
                                <Text style={{ color: '#fa8c16', fontSize: '14px', fontWeight: '500' }}>
                                  Time Remaining: {formatTime(timer)}
                                </Text>
                                {timer <= 60 && timer > 0 && (
                                  <Text style={{ color: '#fa8c16', fontSize: '12px' }}>
                                    (Running Out!)
                                  </Text>
                                )}
                              </div>
                              <Button 
                                onClick={resetTimer} 
                                size="small"
                              >
                                Reset
                              </Button>
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
                                  border: '1px solid #d9d9d9',
                                  borderRadius: '6px',
                                  backgroundColor: '#f5f5f5'
                                }}>
                                  <div style={{ 
                                    display: 'flex', 
                                    flexDirection: 'column',
                                    gap: '16px'
                                  }}>
                                    <div style={{ 
                                      display: 'flex', 
                                      justifyContent: 'space-between',
                                      alignItems: 'center'
                                    }}>
                                      <div style={{ flex: 1 }}>
                                                                              <Text strong style={{ 
                                        display: 'block', 
                                        marginBottom: '6px'
                                      }}>
                                        {criterion.name}
                                      </Text>
                                      <Text type="secondary">
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
                                          value={currentScore === 0 ? undefined : currentScore}
                                          onChange={(value) => updateScore(
                                            participant.id,
                                            criterion.id,
                                            value || 0
                                          )}
                                          disabled={isLocked}
                                          style={{ 
                                            width: '50px',
                                            height: '40px',
                                            textAlign: 'center',
                                            display: 'flex',
                                            alignItems: 'center'
                                          }}
                                          placeholder="0.0"
                                        />
                                        <Text type="secondary" style={{ minWidth: '40px', display: 'flex', alignItems: 'center' }}>
                                          /{criterion.max_score}
                                        </Text>
                                      </div>
                                    </div>
                                    
                                    {/* Slider */}
                                    <div style={{ padding: '0 8px' }}>
                                      <ClickableSlider
                                        min={0}
                                        max={criterion.max_score}
                                        step={0.1}
                                        value={currentScore}
                                        onChange={(value) => updateScore(
                                          participant.id,
                                          criterion.id,
                                          value
                                        )}
                                        onAfterChange={(value) => updateScore(
                                          participant.id,
                                          criterion.id,
                                          value
                                        )}
                                        disabled={isLocked}
                                        tooltip={null}
                                        style={{ margin: 0 }}
                                        trackStyle={{ backgroundColor: '#8b5cf6' }}
                                        handleStyle={{ 
                                          borderColor: '#8b5cf6',
                                          cursor: 'grab',
                                          touchAction: 'none'
                                        }}
                                        railStyle={{ cursor: 'pointer' }}
                                      />
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                          
                          {/* Total Score Display */}
                          <div style={{ 
                            marginTop: '8px', 
                            textAlign: 'center',
                            padding: '12px 0'
                          }}>
                            <Text style={{ fontSize: '14px', color: '#666' }}>
                              Total Score: <Text strong style={{ color: '#262626' }}>
                                {getTotalScoreForParticipant(participant.id).toFixed(1)} / {getMaxPossibleScore().toFixed(1)} 
                                ({Math.round((getTotalScoreForParticipant(participant.id) / getMaxPossibleScore()) * 100)}%)
                              </Text>
                            </Text>
                          </div>

                          {/* Submit Button */}
                          <div style={{ 
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
                    <Col xs={12} sm={8} md={6} lg={4}>
                      <Card
                        hoverable
                        style={{ 
                          cursor: 'pointer',
                          borderColor: isActive ? '#8c8c8c' : undefined,
                          borderWidth: isActive ? 2 : 1,
                          boxShadow: isActive ? '0 2px 8px rgba(0, 0, 0, 0.1)' : undefined
                        }}
                        onClick={() => !isScored && startGroupScoring(group.id)}
                        bodyStyle={{ padding: '12px' }}
                      >
                        <div style={{ textAlign: 'center' }}>
                          <div style={{ 
                            marginBottom: '8px',
                            padding: '8px',
                            backgroundColor: '#f5f5f5',
                            borderRadius: '50%',
                            width: '36px',
                            height: '36px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            margin: '0 auto 8px auto'
                          }}>
                            <Users size={18} color="#666" />
                          </div>
                          
                          <Title level={4} style={{ 
                            margin: 0, 
                            marginBottom: '8px'
                          }}>
                            {group.name}
                          </Title>
                          
                          <div style={{ marginBottom: '8px' }}>
                            <Text type="secondary">
                              {group.members?.length || 0} members
                            </Text>
                          </div>
                          
                          <div style={{ marginBottom: '12px' }}>
                            <Badge 
                              color={isScored ? 'success' : 'processing'} 
                              text={isScored ? 'Completed' : 'Pending'}
                            />
                          </div>
                          
                          <Button 
                            type={isActive ? 'primary' : 'default'}
                            size="middle"
                            disabled={isScored}
                            style={{ 
                              minWidth: '120px',
                              height: '32px',
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
                          title={`Scoring Group: ${group.name}`}
                          extra={
                            <Button 
                              onClick={stopScoring}
                              size="small"
                              icon={<X size={14} color="#ff4d4f" />}
                              style={{
                                width: '32px',
                                height: '32px',
                                borderRadius: '6px',
                                backgroundColor: 'white',
                                borderColor: '#d9d9d9',
                                color: '#ff4d4f',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center'
                              }}
                            />
                          }
                        >
                          <div style={{ padding: '20px 0' }}>
                            {/* Timer Section */}
                            {event?.time_limit && (
                              <div style={{ 
                                marginBottom: '16px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                padding: '12px 0'
                              }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                  <Clock size={16} color="#fa8c16" />
                                  <Text style={{ color: '#fa8c16', fontSize: '14px', fontWeight: '500' }}>
                                    Time Remaining: {Math.floor(timer / 60)}:{(timer % 60).toString().padStart(2, '0')}
                                  </Text>
                                  {timer <= 30 && (
                                    <Text style={{ color: '#fa8c16', fontSize: '12px' }}>
                                      (Running Out!)
                                    </Text>
                                  )}
                                </div>
                                <Button 
                                  size="small"
                                  onClick={() => {
                                    if (event?.time_limit) {
                                      setTimer(event.time_limit * 60);
                                      setIsTimerRunning(true);
                                    }
                                  }}
                                >
                                  Reset
                                </Button>
                              </div>
                            )}

                            {/* Group Members Display */}
                            <div style={{ marginBottom: '24px' }}>
                              <Text strong style={{ marginBottom: '12px', display: 'block' }}>
                                Group Members
                              </Text>
                              <div style={{ 
                                padding: '16px',
                                backgroundColor: '#f5f5f5',
                                borderRadius: '6px',
                                border: '1px solid #d9d9d9'
                              }}>
                                {group.members?.map((member, idx) => (
                                  <div key={idx} style={{ 
                                    display: 'flex', 
                                    justifyContent: 'space-between', 
                                    alignItems: 'center',
                                    padding: '8px 0',
                                    borderBottom: idx < (group.members?.length || 0) - 1 ? '1px solid #d9d9d9' : 'none'
                                  }}>
                                    <span style={{ fontWeight: 500 }}>{member.participant.full_name}</span>
                                    <span style={{ fontSize: '12px', color: '#666' }}>
                                      #{member.participant.chest_number} • {member.participant.church}
                                    </span>
                                  </div>
                                ))}
                              </div>
                            </div>

                            {/* Scoring Criteria */}
                            <div style={{ marginBottom: '24px' }}>
                              <Text strong style={{ marginBottom: '16px', display: 'block' }}>
                                Scoring Criteria
                              </Text>
                              <div style={{ display: 'grid', gap: '16px' }}>
                                {criteria.map((criterion, index) => {
                                  const currentScore = getGroupScoreForCriteria(group.id, criterion.id);
                                  
                                  return (
                                    <div key={criterion.id} style={{ 
                                      padding: '16px',
                                      backgroundColor: '#f5f5f5',
                                      borderRadius: '6px',
                                      border: '1px solid #d9d9d9'
                                    }}>
                                      <div style={{ 
                                        display: 'flex', 
                                        flexDirection: 'column',
                                        gap: '16px'
                                      }}>
                                        <div style={{ 
                                          display: 'flex', 
                                          justifyContent: 'space-between', 
                                          alignItems: 'center'
                                        }}>
                                                                                  <Text strong>
                                          {criterion.name}
                                        </Text>
                                        <Text type="secondary">
                                          Max: {criterion.max_score}
                                        </Text>
                                        </div>
                                        
                                        <div style={{ 
                                          display: 'flex', 
                                          alignItems: 'center', 
                                          gap: '12px',
                                          marginBottom: '8px'
                                        }}>
                                          <InputNumber
                                            value={currentScore === 0 ? undefined : currentScore}
                                            onChange={(value) => updateGroupScore(group.id, criterion.id, value || 0)}
                                            min={0}
                                            max={criterion.max_score}
                                            step={0.1}
                                            style={{ 
                                              width: '50px',
                                              textAlign: 'center',
                                              display: 'flex',
                                              alignItems: 'center'
                                            }}
                                            placeholder="0.0"
                                          />
                                          <Text type="secondary" style={{ minWidth: '40px', display: 'flex', alignItems: 'center' }}>
                                            /{criterion.max_score}
                                          </Text>
                                        </div>
                                        
                                        {/* Slider */}
                                        <div style={{ padding: '0 8px' }}>
                                          <ClickableSlider
                                            min={0}
                                            max={criterion.max_score}
                                            step={0.1}
                                            value={currentScore}
                                            onChange={(value) => updateGroupScore(group.id, criterion.id, value)}
                                            onAfterChange={(value) => updateGroupScore(group.id, criterion.id, value)}
                                            tooltip={null}
                                            style={{ margin: 0 }}
                                            trackStyle={{ backgroundColor: '#8b5cf6' }}
                                            handleStyle={{ 
                                              borderColor: '#8b5cf6',
                                              cursor: 'grab',
                                              touchAction: 'none'
                                            }}
                                            railStyle={{ cursor: 'pointer' }}
                                          />
                                        </div>
                                      </div>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                            
                            {/* Total Score Display */}
                            <div style={{ 
                              marginTop: '8px', 
                              textAlign: 'center',
                              padding: '12px 0'
                            }}>
                              <Text style={{ fontSize: '14px', color: '#666' }}>
                                Total Score: <Text strong style={{ color: '#262626' }}>
                                  {getTotalScoreForGroup(group.id).toFixed(1)} / {getMaxPossibleScore().toFixed(1)} 
                                  ({Math.round((getTotalScoreForGroup(group.id) / getMaxPossibleScore()) * 100)}%)
                                </Text>
                              </Text>
                            </div>

                            {/* Submit Button */}
                            <div style={{ 
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

        </Content>
      </Layout>
    </Layout>
  );
};

export default JudgeScoringInterface;