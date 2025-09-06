import { useState, useEffect } from 'react';
import { useParticipantAuth } from '@/hooks/useParticipantAuth';
import { supabase } from '@/integrations/supabase/client';
import Navigation from '@/components/Navigation';
import { Layout, Card, Button, Badge, Typography, Space, Progress, Spin, message } from 'antd';
import { Calendar, Users, Trophy, Clock, Play } from 'lucide-react';
import { Link } from 'react-router-dom';

const { Content } = Layout;
const { Title, Text } = Typography;

interface AssignedEvent {
  id: string;
  name: string;
  type: string;
  status: string;
  time_limit: number | null;
  event_order: number | null;
  participants_count: number;
  my_scores_count: number;
  total_criteria: number;
  level_id: string;
  event_levels?: {
    id: string;
    name: string;
    is_active: boolean;
  };
}

const JudgeDashboard = () => {
  const { participant } = useParticipantAuth();
  const [assignedEvents, setAssignedEvents] = useState<AssignedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [judgeId, setJudgeId] = useState<string | null>(null);

  useEffect(() => {
    fetchJudgeData();
  }, [participant]);

  // Set up real-time subscriptions for event updates
  useEffect(() => {
    if (!participant?.id) return;

    // Subscribe to event_judges changes for this judge
    const eventJudgesSubscription = supabase
      .channel('event_judges_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'event_judges',
        filter: `judge_id=eq.${participant.id}`
      }, () => {
        fetchJudgeData();
      })
      .subscribe();

    // Subscribe to events table changes
    const eventsSubscription = supabase
      .channel('events_changes')
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'events'
      }, () => {
        fetchJudgeData();
      })
      .subscribe();

    return () => {
      eventJudgesSubscription.unsubscribe();
      eventsSubscription.unsubscribe();
    };
  }, [participant?.id]);

  const fetchJudgeData = async () => {
    console.log('fetchJudgeData called with participant:', participant);
    if (!participant?.id) {
      console.log('No participant ID, returning early');
      setLoading(false);
      return;
    }

    try {
      console.log('Fetching data for judge ID:', participant.id);
      // Use the judge ID from the authenticated participant data
      setJudgeId(participant.id);

      // Get assigned events with participant count and scoring progress
      const { data: eventsData, error: eventsError } = await supabase
        .from('event_judges')
        .select(`
          events (
            id,
            name,
            type,
            status,
            time_limit,
            event_order,
            level_id,
            event_levels (
              id,
              name,
              is_active
            )
          )
        `)
        .eq('judge_id', participant.id);

      if (eventsError) throw eventsError;

      // For each event, get participant count, criteria count, and judge's scoring progress
      const enrichedEvents = await Promise.all(
        eventsData.map(async (eventJudge: any) => {
          const event = eventJudge.events;
          
          // Get participant count
          const { count: participantCount } = await supabase
            .from('event_participants')
            .select('*', { count: 'exact', head: true })
            .eq('event_id', event.id);

          // Get criteria count
          const { count: criteriaCount } = await supabase
            .from('event_criteria')
            .select('*', { count: 'exact', head: true })
            .eq('event_id', event.id);

          // Get judge's scores count
          const { count: scoresCount } = await supabase
            .from('scores')
            .select('*', { count: 'exact', head: true })
            .eq('event_id', event.id)
            .eq('judge_id', participant.id);

          return {
            ...event,
            participants_count: participantCount || 0,
            my_scores_count: scoresCount || 0,
            total_criteria: criteriaCount || 0,
          };
        })
      );

      // Sort by event order
      enrichedEvents.sort((a, b) => {
        if (a.event_order === null && b.event_order === null) return 0;
        if (a.event_order === null) return 1;
        if (b.event_order === null) return -1;
        return a.event_order - b.event_order;
      });

      setAssignedEvents(enrichedEvents);
    } catch (error) {
      message.error('Failed to load assigned events');
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status: string): "success" | "processing" | "default" | "error" | "warning" => {
    switch (status) {
      case 'active':
        return 'processing';
      case 'completed':
        return 'success';
      case 'upcoming':
        return 'default';
      default:
        return 'default';
    }
  };

  const getScoringProgress = (event: AssignedEvent) => {
    const expectedScores = event.participants_count * event.total_criteria;
    const actualScores = event.my_scores_count;
    
    if (expectedScores === 0) return 0;
    return Math.round((actualScores / expectedScores) * 100);
  };

  const isEventComplete = (event: AssignedEvent) => {
    return getScoringProgress(event) === 100;
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Navigation />
      
      <Layout className="md:ml-64">
        <Content style={{ padding: '16px', paddingBottom: '80px', paddingTop: '80px' }} className="md:px-6 md:pt-4">
          <div style={{ marginBottom: '24px' }}>
            <div style={{ marginBottom: '8px' }}>
              <Title level={2} style={{ margin: 0 }}>
                Judge Dashboard
              </Title>
            </div>
            <Text type="secondary">
              Welcome back, {participant?.full_name || 'Judge'}
            </Text>
          </div>

          {loading && (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Spin size="large" />
              <div style={{ marginTop: '16px' }}>
                <Text>Loading assigned events...</Text>
              </div>
            </div>
          )}

          {!loading && !participant && (
            <div style={{ textAlign: 'center', padding: '40px' }}>
              <Text type="danger">Not authenticated. Please sign in again.</Text>
            </div>
          )}

          {/* Summary Cards */}
          {!loading && participant && (
            <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <Text strong style={{ fontSize: '14px' }}>
                  Assigned Events
                </Text>
                <Calendar size={16} color="#6b7280" />
              </div>
              <div>
                <Title level={2} style={{ margin: 0 }}>{assignedEvents.length}</Title>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  Events to judge
                </Text>
              </div>
            </Card>

            <Card>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <Text strong style={{ fontSize: '14px' }}>
                  Active Events
                </Text>
                <Play size={16} color="#6b7280" />
              </div>
              <div>
                <Title level={2} style={{ margin: 0 }}>
                  {assignedEvents.filter(e => e.status === 'active').length}
                </Title>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  Ready to score
                </Text>
              </div>
            </Card>

            <Card>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <Text strong style={{ fontSize: '14px' }}>
                  Completed
                </Text>
                <Trophy size={16} color="#6b7280" />
              </div>
              <div>
                <Title level={2} style={{ margin: 0 }}>
                  {assignedEvents.filter(e => isEventComplete(e)).length}
                </Title>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  Fully scored
                </Text>
              </div>
            </Card>
          </div>

          {/* Assigned Events */}
          <Card>
            <div style={{ marginBottom: '16px' }}>
              <Title level={4} style={{ margin: 0 }}>My Assigned Events</Title>
              <Text type="secondary">
                Events you are assigned to judge
              </Text>
            </div>
            
            {loading ? (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <Spin size="large" />
              </div>
            ) : assignedEvents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '32px 0' }}>
                <Text type="secondary">No events assigned yet</Text>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
                {assignedEvents.map((event) => {
                  const progress = getScoringProgress(event);
                  const isComplete = isEventComplete(event);
                  const isInactive = event.event_levels && !event.event_levels.is_active;
                  
                  return (
                    <Card 
                      key={event.id} 
                      size="small"
                      style={{ 
                        opacity: isInactive ? 0.6 : 1,
                        backgroundColor: isInactive ? '#f5f5f5' : 'inherit'
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
                        <div style={{ flex: 1 }}>
                          <Title level={5} style={{ margin: 0, marginBottom: '4px' }}>{event.name}</Title>
                          <Space size={16} wrap>
                            <Text type="secondary" style={{ textTransform: 'capitalize' }}>
                              {event.type} Performance
                            </Text>
                            <Space size={4}>
                              <Users size={12} />
                              <Text type="secondary" style={{ fontSize: '12px' }}>
                                {event.participants_count} participants
                              </Text>
                            </Space>
                            {event.time_limit && (
                              <Space size={4}>
                                <Clock size={12} />
                                <Text type="secondary" style={{ fontSize: '12px' }}>
                                  {event.time_limit} min limit
                                </Text>
                              </Space>
                            )}
                          </Space>
                        </div>
                        <Space>
                          <Badge status={getStatusColor(event.status)} text={event.status} />
                          {event.event_order && (
                            <Badge count={`#${event.event_order}`} color="blue" />
                          )}
                        </Space>
                      </div>
                      
                      <div style={{ marginBottom: '12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
                          <Text strong style={{ fontSize: '14px' }}>Scoring Progress</Text>
                          <Text type="secondary" style={{ fontSize: '12px' }}>
                            {event.my_scores_count}/{event.participants_count * event.total_criteria} scores
                          </Text>
                        </div>
                        <Progress 
                          percent={progress} 
                          status={progress === 100 ? 'success' : 'active'}
                          showInfo={false}
                        />
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <div>
                          {isComplete ? (
                            <Text type="success" strong>
                              ✓ Scoring Complete
                            </Text>
                          ) : event.status === 'active' ? (
                            <Text style={{ color: '#8b5cf6' }} strong>
                              Ready to Score
                            </Text>
                          ) : (
                            <Text type="secondary">
                              {event.status === 'upcoming' ? 'Upcoming' : 'Not Started'}
                            </Text>
                          )}
                        </div>
                        
                        {event.status === 'active' && !isInactive ? (
                          <Space>
                            <Link to={`/judge/score/${event.id}`}>
                              <Button type="primary">
                                {progress > 0 ? 'Continue Scoring' : 'Start Scoring'}
                              </Button>
                            </Link>
                            {/* Admin only feature - removed for judges */}
                          </Space>
                        ) : (
                          <Button disabled>
                            {isInactive ? 'Season Inactive' : event.status === 'completed' ? 'View Details' : 'Not Available'}
                          </Button>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </Card>
            </>
          )}
        </Content>
      </Layout>
    </Layout>
  );
};

export default JudgeDashboard;