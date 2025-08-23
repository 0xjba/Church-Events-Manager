import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
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
}

const JudgeDashboard = () => {
  const { profile, isAdmin } = useAuth();
  const [assignedEvents, setAssignedEvents] = useState<AssignedEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [judgeId, setJudgeId] = useState<string | null>(null);

  useEffect(() => {
    fetchJudgeData();
  }, [profile]);

  const fetchJudgeData = async () => {
    if (!profile?.id) return;

    try {
      // First get the judge ID
      const { data: judgeData, error: judgeError } = await supabase
        .from('judges')
        .select('id')
        .eq('profile_id', profile.id)
        .single();

      if (judgeError) throw judgeError;
      setJudgeId(judgeData.id);

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
            event_order
          )
        `)
        .eq('judge_id', judgeData.id);

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
            .eq('judge_id', judgeData.id);

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
      
      <Layout style={{ marginLeft: '256px' }}>
        <Content style={{ padding: '16px 24px', paddingBottom: '80px' }}>
          <div style={{ marginBottom: '24px' }}>
            <Title level={2} style={{ margin: 0 }}>
              Judge Dashboard
            </Title>
            <Text type="secondary">
              Welcome back, {profile?.full_name}
            </Text>
          </div>

          {/* Summary Cards */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: '16px', marginBottom: '24px' }}>
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
                <Text strong style={{ fontSize: '14px' }}>
                  Assigned Events
                </Text>
                <Calendar size={16} color="#8c8c8c" />
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
                <Play size={16} color="#8c8c8c" />
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
                <Trophy size={16} color="#8c8c8c" />
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
                  
                  return (
                    <Card key={event.id} size="small">
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
                            <Text style={{ color: '#fa8c16' }} strong>
                              Ready to Score
                            </Text>
                          ) : (
                            <Text type="secondary">
                              {event.status === 'upcoming' ? 'Upcoming' : 'Not Started'}
                            </Text>
                          )}
                        </div>
                        
                        {event.status === 'active' ? (
                          <Space>
                            <Link to={`/judge/score/${event.id}`}>
                              <Button type="primary">
                                {progress > 0 ? 'Continue Scoring' : 'Start Scoring'}
                              </Button>
                            </Link>
                            {isAdmin && (
                              <Link to={`/admin/scoreboard/${event.id}`}>
                                <Button>View Scoreboard</Button>
                              </Link>
                            )}
                          </Space>
                        ) : (
                          <Button disabled>
                            {event.status === 'completed' ? 'View Details' : 'Not Available'}
                          </Button>
                        )}
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </Card>
        </Content>
      </Layout>
    </Layout>
  );
};

export default JudgeDashboard;