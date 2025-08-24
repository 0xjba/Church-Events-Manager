import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ResultsCalculator } from '@/utils/resultsCalculator';
import Navigation from '@/components/Navigation';
import ResponsiveTable from '@/components/ResponsiveTable';
import { Layout, Card, Button, Badge, Modal, Select, Typography, Space, Spin, message } from 'antd';
import { Calculator, Eye, EyeOff, Download, FileText, Trophy, RefreshCw } from 'lucide-react';
import { ExportUtils } from '@/utils/exportUtils';

const { Content } = Layout;
const { Title, Text } = Typography;

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
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState<string | null>(null);
  const [viewingResults, setViewingResults] = useState<string | null>(null);
  const [resultsData, setResultsData] = useState<any[]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [currentEventType, setCurrentEventType] = useState<string>('individual');

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
      message.error('Failed to load events');
    } finally {
      setLoading(false);
    }
  };

  const calculateResults = async (eventId: string) => {
    try {
      setCalculating(eventId);
      message.loading('Calculating results...', 0);
      
      // First, get the event details to determine the event type
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('event_type')
        .eq('id', eventId)
        .single();

      if (eventError) throw eventError;

      // Check if event has participants/groups and scores based on event type
      if (eventData.event_type === 'individual') {
        // Check for participants
        const { data: participants, error: participantsError } = await supabase
          .from('event_participants')
          .select('participant_id')
          .eq('event_id', eventId);

        if (participantsError) throw participantsError;
        if (!participants || participants.length === 0) {
          message.destroy();
          message.warning('No participants found for this event');
          return;
        }
      } else {
        // Check for groups
        const { data: groups, error: groupsError } = await supabase
          .from('event_groups')
          .select('group_id')
          .eq('event_id', eventId);

        if (groupsError) throw groupsError;
        if (!groups || groups.length === 0) {
          message.destroy();
          message.warning('No groups found for this event');
          return;
        }
      }

      const { data: scores, error: scoresError } = await supabase
        .from('scores')
        .select('id')
        .eq('event_id', eventId)
        .eq('is_locked', true);

      if (scoresError) throw scoresError;
      if (!scores || scores.length === 0) {
        message.destroy();
        message.warning('No locked scores found for this event');
        return;
      }
      
      // Calculate results using the ResultsCalculator
      const results = await ResultsCalculator.calculateEventResults(eventId);
      
      // Save results to the database for all participants/groups
      const resultsToInsert = results.results.map(result => {
        const baseResult = {
          event_id: eventId,
          total_score: result.total_score,
          average_score: result.average_score,
          rank: result.rank,
          tie_breaker_reason: result.tie_breaker_reason,
          calculated_at: new Date().toISOString()
        };

        // Add either participant_id or group_id based on event type
        if (eventData.event_type === 'individual') {
          return {
            ...baseResult,
            participant_id: result.participant_id
          };
        } else {
          return {
            ...baseResult,
            group_id: result.group_id
          };
        }
      });

      // First, delete any existing results for this event
      const { error: deleteError } = await supabase
        .from('results')
        .delete()
        .eq('event_id', eventId);

      if (deleteError) throw deleteError;

      // Then insert the new results
      const { error: insertError } = await supabase
        .from('results')
        .insert(resultsToInsert);

      if (insertError) throw insertError;
      
      // Update the event to mark results as published
      const { error: updateError } = await supabase
        .from('events')
        .update({ results_published: true })
        .eq('id', eventId);
      
      if (updateError) throw updateError;
      
      message.destroy();
      const entityType = eventData.event_type === 'individual' ? 'participants' : 'groups';
      message.success(`Results calculated successfully for ${results.results.length} ${entityType}!`);
      
      // Refresh events to show updated status
      await fetchEvents();
      
    } catch (error) {
      message.destroy();
      console.error('Error calculating results:', error);
      message.error('Failed to calculate results. Please check the console for details.');
    } finally {
      setCalculating(null);
    }
  };

  const fetchResults = async (eventId: string) => {
    try {
      setResultsLoading(true);
      setViewingResults(eventId);
      
      // First, get the event details to determine the event type
      const { data: eventData, error: eventError } = await supabase
        .from('events')
        .select('event_type')
        .eq('id', eventId)
        .single();

      if (eventError) throw eventError;
      
      // Store the event type for use in display logic
      setCurrentEventType(eventData.event_type);
      
      // Fetch results based on event type
      let resultsQuery;
      if (eventData.event_type === 'individual') {
        // Fetch individual event results with participant details
        resultsQuery = supabase
          .from('results')
          .select(`
            *,
            participant:participants(
              full_name,
              chest_number,
              category,
              church
            )
          `)
          .eq('event_id', eventId)
          .not('participant_id', 'is', null)
          .order('rank', { ascending: true });
      } else {
        // Fetch group event results with group details
        resultsQuery = supabase
          .from('results')
          .select(`
            *,
            group:groups(
              name,
              description
            )
          `)
          .eq('event_id', eventId)
          .not('group_id', 'is', null)
          .order('rank', { ascending: true });
      }
      
      const { data: results, error: resultsError } = await resultsQuery;
      
      if (resultsError) throw resultsError;
      
      // Fetch criteria for this event
      const { data: criteria, error: criteriaError } = await supabase
        .from('event_criteria')
        .select('*')
        .eq('event_id', eventId)
        .order('created_at');
      
      if (criteriaError) throw criteriaError;
      
      // Fetch detailed scores based on event type
      let scores;
      let scoresError;
      
      if (currentEventType === 'individual') {
        // For individual events, fetch only participant scores
        const { data, error } = await supabase
          .from('scores')
          .select(`
            *,
            judge:judges(
              full_name,
              church
            )
          `)
          .eq('event_id', eventId)
          .eq('is_locked', true)
          .not('participant_id', 'is', null);
        
        scores = data;
        scoresError = error;
      } else {
        // For group events, fetch only group scores
        const { data, error } = await supabase
          .from('scores')
          .select(`
            *,
            judge:judges(
              full_name,
              church
            )
          `)
          .eq('event_id', eventId)
          .eq('is_locked', true)
          .not('group_id', 'is', null);
        
        scores = data;
        scoresError = error;
      }
      
      if (scoresError) throw scoresError;
      
      // Combine all data with detailed judge scores
      const detailedResults = results?.map(result => {
        // Get scores for this specific entity
        let entityScores;
        if (currentEventType === 'individual') {
          entityScores = scores?.filter(s => s.participant_id === result.participant_id) || [];
        } else {
          entityScores = scores?.filter(s => s.group_id === result.group_id) || [];
        }
        
        // Group scores by criteria with judge details
        const criteriaScores = criteria?.map(criterion => {
          const criteriaScores = entityScores.filter(s => s.criteria_id === criterion.id);
          const judgeScores = criteriaScores.map(score => ({
            judgeName: score.judge?.full_name || 'Unknown Judge',
            judgeChurch: score.judge?.church || 'Unknown Church',
            score: score.score
          }));
          
          // Calculate average score
          const averageScore = criteriaScores.length > 0 
            ? criteriaScores.reduce((sum, s) => sum + s.score, 0) / criteriaScores.length
            : 0;
          
          return {
            ...criterion,
            judgeScores,
            averageScore,
            maxPossibleScore: criterion.max_score
          };
        }) || [];
        
        return {
          ...result,
          criteriaScores,
          maxPossibleScore: criteria?.reduce((total, c) => total + c.max_score, 0) || 0
        };
      }) || [];
      
      setResultsData(detailedResults);
      
    } catch (error) {
      console.error('Error fetching results:', error);
      message.error('Failed to fetch results');
    } finally {
      setResultsLoading(false);
    }
  };

  const columns = [
    { title: 'Event', dataIndex: 'name', key: 'name' },
    { title: 'Type', dataIndex: 'type', key: 'type' },
    { title: 'Status', dataIndex: 'status', key: 'status', render: (status: string) => <Badge color="blue" text={status} /> },
    { title: 'Results', dataIndex: 'results_published', key: 'results_published', render: (published: boolean) => <Badge color={published ? 'green' : 'orange'} text={published ? 'Published' : 'Draft'} /> },
    { 
      title: 'Actions', 
      key: 'actions', 
      render: (_, record: Event) => (
        <Space>
          {!record.results_published ? (
            <Button 
              type="primary" 
              icon={<Calculator size={16} />}
              onClick={() => calculateResults(record.id)}
              loading={calculating === record.id}
              disabled={calculating !== null || record.status !== 'completed'}
              title={record.status !== 'completed' ? 'Event must be completed to calculate results' : 'Calculate results'}
            >
              Calculate
            </Button>
          ) : (
            <Button 
              type="default" 
              icon={<Eye size={16} />}
              onClick={() => fetchResults(record.id)}
              title="View calculated results"
            >
              View Results
            </Button>
          )}
        </Space>
      )
    },
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Navigation />
      <Layout className="md:ml-64">
        <Content style={{ padding: '16px' }} className="md:px-6">
          <div style={{ marginBottom: '24px' }}>
            <Title level={2}>Results Management</Title>
            <Text type="secondary">Calculate and publish event results</Text>
          </div>
          <Card>
            <ResponsiveTable
              columns={columns}
              dataSource={events}
              loading={loading}
              rowKey="id"
              cardTitle={(record) => record.name}
            />
          </Card>

          {/* Results Modal */}
          <Modal
            title="Event Results"
            open={!!viewingResults}
            onCancel={() => {
              setViewingResults(null);
              setResultsData([]);
            }}
            footer={null}
            width={1000}
          >
            {resultsLoading ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <Spin size="large" />
                <div style={{ marginTop: '16px' }}>Loading results...</div>
              </div>
            ) : (
              <div>
                <div style={{ marginBottom: '20px' }}>
                  <Text strong style={{ fontSize: '16px' }}>Detailed Rankings and Scores</Text>
                </div>
                <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
                  {resultsData.map((result, index) => (
                    <div
                      key={result.id}
                      style={{
                        border: '1px solid #e5e7eb',
                        borderRadius: '12px',
                        marginBottom: '16px',
                        backgroundColor: index < 3 ? '#fef3c7' : '#f9fafb',
                        overflow: 'hidden'
                      }}
                    >
                      {/* Participant Header */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '16px',
                        backgroundColor: index < 3 ? '#fbbf24' : '#6b7280',
                        color: 'white'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            backgroundColor: 'white',
                            color: index < 3 ? '#fbbf24' : '#6b7280',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '16px',
                            fontWeight: 'bold'
                          }}>
                            {result.rank}
                          </div>
                          <div>
                            <Text strong style={{ fontSize: '16px', color: 'white' }}>
                              {currentEventType === 'individual' 
                                ? `${result.participant?.full_name} (#${result.participant?.chest_number})`
                                : `${result.group?.name} (Group)`
                              }
                            </Text>
                            <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)' }}>
                              {currentEventType === 'individual'
                                ? `${result.participant?.category} • ${result.participant?.church}`
                                : result.group?.description || 'Group Performance'
                              }
                            </div>
                          </div>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <Text strong style={{ fontSize: '20px', color: 'white' }}>
                            {result.total_score.toFixed(1)} / {result.maxPossibleScore}
                          </Text>
                          <div style={{ fontSize: '13px', color: 'rgba(255,255,255,0.8)' }}>
                            Final Score
                          </div>
                        </div>
                      </div>
                      
                      {/* Criteria Scores */}
                      <div style={{ padding: '16px' }}>
                        <div style={{ marginBottom: '12px' }}>
                          <Text strong style={{ fontSize: '14px', color: '#374151' }}>Detailed Scoring Breakdown:</Text>
                        </div>
                        <div style={{ display: 'grid', gap: '12px' }}>
                          {result.criteriaScores?.map((criteria, criteriaIndex) => (
                            <div
                              key={criteriaIndex}
                              style={{
                                border: '1px solid #e2e8f0',
                                borderRadius: '8px',
                                overflow: 'hidden'
                              }}
                            >
                              {/* Criteria Header */}
                              <div style={{
                                padding: '10px 12px',
                                backgroundColor: '#f1f5f9',
                                borderBottom: '1px solid #e2e8f0'
                              }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                  <Text strong style={{ fontSize: '14px', color: '#1e293b' }}>
                                    {criteria.name}
                                  </Text>
                                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                    <Text style={{ fontSize: '14px', color: '#059669', fontWeight: 600 }}>
                                      Avg: {criteria.averageScore.toFixed(1)}
                                    </Text>
                                    <Text style={{ fontSize: '12px', color: '#6b7280' }}>
                                      / {criteria.maxPossibleScore}
                                    </Text>
                                  </div>
                                </div>
                              </div>
                              
                              {/* Individual Judge Scores */}
                              <div style={{ padding: '8px 12px' }}>
                                {criteria.judgeScores?.map((judgeScore, judgeIndex) => (
                                  <div
                                    key={judgeIndex}
                                    style={{
                                      display: 'flex',
                                      justifyContent: 'space-between',
                                      alignItems: 'center',
                                      padding: '6px 0',
                                      borderBottom: judgeIndex < criteria.judgeScores.length - 1 ? '1px solid #f1f5f9' : 'none'
                                    }}
                                  >
                                    <div style={{ flex: 1 }}>
                                      <Text style={{ fontSize: '12px', color: '#475569' }}>
                                        {judgeScore.judgeName} ({judgeScore.judgeChurch})
                                      </Text>
                                    </div>
                                    <div style={{ 
                                      display: 'flex', 
                                      alignItems: 'center', 
                                      gap: '6px',
                                      minWidth: '80px',
                                      justifyContent: 'flex-end'
                                    }}>
                                      <Text style={{ fontSize: '12px', color: '#059669', fontWeight: 500 }}>
                                        {judgeScore.score.toFixed(1)}
                                      </Text>
                                      <Text style={{ fontSize: '11px', color: '#94a3b8' }}>
                                        / {criteria.maxPossibleScore}
                                      </Text>
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </Modal>
        </Content>
      </Layout>
    </Layout>
  );
};

export default ResultsManagement;