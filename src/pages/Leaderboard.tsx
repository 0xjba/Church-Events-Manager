import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ResultsCalculator } from '@/utils/resultsCalculator';
import Navigation from '@/components/Navigation';
import { Layout, Card, Button, Select, Table, Badge, Typography, Space, Spin, message } from 'antd';
import { Trophy, Medal, Award, Filter, RefreshCw } from 'lucide-react';

const { Content } = Layout;
const { Title, Text } = Typography;

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
  // Category filtering removed as participant category column was dropped
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
  }, [selectedEvent]);

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
      message.error('Failed to load published events');
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
      
      // Note: Category filtering removed as participant category column was dropped
      // All participants are now treated equally regardless of category
      
      setEventResults(filteredResults);
    } catch (error) {
      message.error('Failed to load event results');
    }
  };

  const fetchChampionshipStandings = async () => {
    try {
      const eventIds = events.map(e => e.id);
      const standings = await ResultsCalculator.getChampionshipStandings(eventIds);
      
      let filteredStandings = standings.participants;
      
      // Note: Category filtering removed as participant category column was dropped
      // All participants are now treated equally regardless of category
      
      setChampionshipData({
        ...standings,
        participants: filteredStandings
      });
      
      setShowChampionship(true);
    } catch (error) {
      message.error('Failed to load championship standings');
    }
  };

  const getRankIcon = (rank: number) => {
    switch (rank) {
      case 1:
        return <Trophy size={20} style={{ color: '#8b5cf6' }} />;
      case 2:
        return <Medal size={20} style={{ color: '#6b7280' }} />;
      case 3:
        return <Award size={20} style={{ color: '#6b7280' }} />;
      default:
        return <span style={{ fontWeight: 'bold' }}>#{rank}</span>;
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

  const eventResultColumns = [
    {
      title: 'Rank',
      dataIndex: 'rank',
      key: 'rank',
      width: 80,
      render: (rank: number, record: EventResult) => (
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: '18px', marginBottom: '4px' }}>
            {getRankEmoji(rank)}
          </div>
          {record.tie_breaker_reason && (
            <Badge color="orange" text="Tie" />
          )}
        </div>
      ),
    },
    {
      title: 'Participant',
      dataIndex: 'participants',
      key: 'participant',
      render: (participant: any) => (
        <div>
          <div style={{ fontWeight: 'medium' }}>{participant.full_name}</div>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            #{participant.chest_number}
          </Text>
        </div>
      ),
    },
    // Category column removed as participant category column was dropped
    {
      title: 'Church',
      dataIndex: ['participants', 'church'],
      key: 'church',
    },
    {
      title: 'District',
      dataIndex: ['participants', 'district'],
      key: 'district',
    },
    {
      title: 'Total Score',
      dataIndex: 'total_score',
      key: 'total_score',
      render: (score: number) => <span style={{ fontWeight: 'bold', fontSize: '16px' }}>{score}</span>,
    },
    {
      title: 'Average Score',
      dataIndex: 'average_score',
      key: 'average_score',
    },
  ];

  const championshipColumns = [
    {
      title: 'Rank',
      dataIndex: 'rank',
      key: 'rank',
      width: 80,
      render: (rank: number) => (
        <div style={{ textAlign: 'center' }}>
          {getRankIcon(rank)}
        </div>
      ),
    },
    {
      title: 'Participant',
      dataIndex: 'participant',
      key: 'participant',
      render: (participant: any) => (
        <div>
          <div style={{ fontWeight: 'medium' }}>{participant.full_name}</div>
          <Text type="secondary" style={{ fontSize: '12px' }}>
            #{participant.chest_number}
          </Text>
        </div>
      ),
    },
    {
      title: 'Category',
      dataIndex: ['participant', 'category'],
      key: 'category',
      render: (category: string) => <span style={{ textTransform: 'capitalize' }}>{category}</span>,
    },
    {
      title: 'Church',
      dataIndex: ['participant', 'church'],
      key: 'church',
    },
    {
      title: 'District',
      dataIndex: ['participant', 'district'],
      key: 'district',
    },
    {
      title: 'Events',
      dataIndex: 'events_participated',
      key: 'events_participated',
    },
    {
      title: 'Championship Points',
      dataIndex: 'total_championship_points',
      key: 'total_championship_points',
      render: (points: number) => <span style={{ fontWeight: 'bold', fontSize: '16px' }}>{points}</span>,
    },
    {
      title: 'Avg Score',
      dataIndex: 'average_score',
      key: 'average_score',
      render: (score: number) => score.toFixed(1),
    },
    {
      title: 'Best Rank',
      dataIndex: 'best_rank',
      key: 'best_rank',
      render: (rank: number) => `#${rank}`,
    },
  ];

  if (loading) {
    return (
      <Layout style={{ minHeight: '100vh' }}>
        <Navigation />
        <Layout style={{ marginLeft: '256px' }}>
          <Content style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Spin size="large" />
          </Content>
        </Layout>
      </Layout>
    );
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Navigation />
      
      <Layout style={{ marginLeft: '256px' }}>
        <Content style={{ padding: '16px 24px', paddingBottom: '80px' }}>
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <img 
                  src="/pypa-logo.png" 
                  alt="PYPA Logo" 
                  style={{ 
                    width: 32, 
                    height: 32, 
                    borderRadius: '8px',
                    marginRight: '12px'
                  }} 
                />
                <div>
                  <Title level={2} style={{ margin: 0 }}>
                    Leaderboard
                  </Title>
                  <Text type="secondary">
                    Competition results and rankings
                  </Text>
                </div>
              </div>
              
              <Button 
                type="primary" 
                icon={<Trophy size={16} />} 
                onClick={fetchChampionshipStandings}
              >
                Championship Standings
              </Button>
            </div>
          </div>

          {/* Filters */}
          <Card style={{ marginBottom: '24px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px', alignItems: 'end' }}>
              <div>
                <Text strong style={{ display: 'block', marginBottom: '8px' }}>Event</Text>
                <Select 
                  value={selectedEvent} 
                  onChange={setSelectedEvent}
                  style={{ width: '100%' }}
                  placeholder="Select event"
                >
                  {events.map(event => (
                    <Select.Option key={event.id} value={event.id}>
                      {event.name}
                    </Select.Option>
                  ))}
                </Select>
              </div>
              
              {/* Category filter removed as participant category column was dropped */}
              
              <div>
                <Button
                  onClick={() => setShowChampionship(!showChampionship)}
                >
                  {showChampionship ? 'Event Results' : 'Championship'}
                </Button>
              </div>
            </div>
          </Card>

          {/* Championship Standings */}
          {showChampionship && championshipData ? (
            <Card>
              <div style={{ marginBottom: '16px' }}>
                <Space align="center">
                  <Trophy size={24} style={{ color: '#8b5cf6' }} />
                  <Title level={3} style={{ margin: 0 }}>Championship Standings</Title>
                </Space>
                <Text type="secondary">
                  Overall rankings across {championshipData.events_count} events
                </Text>
              </div>
              
              <Table
                columns={championshipColumns}
                dataSource={championshipData.participants}
                rowKey="participant.id"
                pagination={{ pageSize: 50 }}
                rowClassName={(_, index) => index < 3 ? 'championship-top-three' : ''}
              />
            </Card>
          ) : (
            /* Event Results */
            <Card>
              <div style={{ marginBottom: '16px' }}>
                <Space align="center">
                  <Medal size={20} />
                  <Title level={3} style={{ margin: 0 }}>
                    {events.find(e => e.id === selectedEvent)?.name || 'Event Results'}
                  </Title>
                </Space>
                <Text type="secondary">
                  Event leaderboard and participant rankings
                </Text>
              </div>
              
              {eventResults.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '32px 0' }}>
                  <Text type="secondary">
                    {selectedEvent ? 'No results available for this event' : 'Select an event to view results'}
                  </Text>
                </div>
              ) : (
                <Table
                  columns={eventResultColumns}
                  dataSource={eventResults}
                  rowKey="id"
                  pagination={{ pageSize: 50 }}
                  rowClassName={(_, index) => index < 3 ? 'event-top-three' : ''}
                />
              )}
            </Card>
          )}

          {events.length === 0 && (
            <Card>
                          <div style={{ textAlign: 'center', padding: '32px 0' }}>
              <img 
                src="/pypa-logo.png" 
                alt="PYPA Logo" 
                style={{ 
                  width: 48, 
                  height: 48, 
                  borderRadius: '12px',
                  marginBottom: '16px',
                  opacity: 0.3
                }} 
              />
              <Title level={4} style={{ marginBottom: '8px' }}>No Published Results</Title>
              <Text type="secondary">
                Results will appear here once events are completed and published by administrators.
              </Text>
            </div>
            </Card>
          )}
        </Content>
      </Layout>
    </Layout>
  );
};

export default Leaderboard;