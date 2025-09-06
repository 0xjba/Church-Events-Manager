import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { ResultsCalculator } from '@/utils/resultsCalculator';
import Navigation from '@/components/Navigation';
import ResponsiveTable from '@/components/ResponsiveTable';
import { Layout, Card, Button, Badge, Modal, Select, Typography, Space, Spin, message } from 'antd';
import { Calculator, Eye, EyeOff, Download, FileText, Trophy, RefreshCw } from 'lucide-react';
import { ExportUtils, WinnersExportData } from '@/utils/exportUtils';

const { Content } = Layout;
const { Title, Text } = Typography;

interface Event {
  id: string;
  name: string;
  type: string;
  status: string;
  results_published: boolean;
  event_order: number | null;
  age_category: string | null;
}

const ResultsManagement = () => {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState<string | null>(null);
  const [viewingResults, setViewingResults] = useState<string | null>(null);
  const [resultsData, setResultsData] = useState<any[]>([]);
  const [resultsLoading, setResultsLoading] = useState(false);
  const [currentEventType, setCurrentEventType] = useState<string>('individual');
  const [exportingWinners, setExportingWinners] = useState(false);
  const [viewingWinners, setViewingWinners] = useState(false);
  const [winnersData, setWinnersData] = useState<WinnersExportData | null>(null);
  const [showScoresForEvent, setShowScoresForEvent] = useState<Record<string, boolean>>({});
  const [individualChampion, setIndividualChampion] = useState<any>(null);

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
              age_category,
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

  const fetchWinners = async () => {
    try {
      setExportingWinners(true);
      message.loading('Loading winners data...', 0);

      // Get all completed events with published results
      const { data: completedEvents, error: eventsError } = await supabase
        .from('events')
        .select('*')
        .eq('status', 'completed')
        .eq('results_published', true)
        .order('event_order', { ascending: true, nullsFirst: false });

      if (eventsError) throw eventsError;

      if (!completedEvents || completedEvents.length === 0) {
        message.destroy();
        message.warning('No completed events with published results found');
        return;
      }

      // Fetch winners (top 3) for each event
      const winnersData: WinnersExportData = {
        events: [],
        generated_at: new Date().toISOString()
      };

      for (const event of completedEvents) {
        // Get top 3 results for this event
        const { data: eventResults, error: resultsError } = await supabase
          .from('results')
          .select(`
            *,
            participant:participants(
              full_name,
              chest_number,
              church,
              district
            )
          `)
          .eq('event_id', event.id)
          .not('participant_id', 'is', null)
          .order('rank', { ascending: true })
          .limit(3);

        if (resultsError) throw resultsError;

        if (eventResults && eventResults.length > 0) {
          winnersData.events.push({
            event_id: event.id,
            event_name: event.name,
            event_type: event.event_type,
            age_category: event.age_category,
            winners: eventResults.map(result => ({
              rank: result.rank || 0,
              total_score: result.total_score,
              average_score: result.average_score,
              tie_breaker_reason: result.tie_breaker_reason,
              participant: {
                full_name: result.participant?.full_name || 'Unknown',
                chest_number: result.participant?.chest_number || 'N/A',
                church: result.participant?.church || 'Unknown',
                district: result.participant?.district || 'Unknown'
              }
            }))
          });
        }
      }

      message.destroy();
      
      if (winnersData.events.length === 0) {
        message.warning('No winners found in completed events');
        return;
      }

      setWinnersData(winnersData);
      
      // Calculate Individual Champion
      const champion = calculateIndividualChampion(winnersData.events);
      setIndividualChampion(champion);
      
      setViewingWinners(true);
      setShowScoresForEvent({}); // Reset score visibility for all events when opening modal

    } catch (error) {
      message.destroy();
      console.error('Error fetching winners:', error);
      message.error('Failed to fetch winners. Please check the console for details.');
    } finally {
      setExportingWinners(false);
    }
  };

  const exportWinners = () => {
    if (winnersData) {
      ExportUtils.downloadWinnersCSV(winnersData);
      message.success(`Winners export completed! Exported ${winnersData.events.length} events with winners.`);
    }
  };

  const calculateIndividualChampion = (events: any[]) => {
    const participantPoints: Record<string, any> = {};

    // Calculate points for each participant
    events.forEach(event => {
      event.winners.forEach((winner: any) => {
        const participantId = winner.participant.full_name;
        
        if (!participantPoints[participantId]) {
          participantPoints[participantId] = {
            participant: winner.participant,
            totalPoints: 0
          };
        }

        // Add points based on rank
        if (winner.rank === 1) {
          participantPoints[participantId].totalPoints += 5;
        } else if (winner.rank === 2) {
          participantPoints[participantId].totalPoints += 3;
        }
      });
    });

    // Find participant with highest points
    let champion = null;
    let maxPoints = 0;

    Object.values(participantPoints).forEach((participant: any) => {
      if (participant.totalPoints > maxPoints) {
        maxPoints = participant.totalPoints;
        champion = participant;
      }
    });

    return champion;
  };

  const columns = [
    { title: 'Event', dataIndex: 'name', key: 'name' },
    { title: 'Age Category', dataIndex: 'age_category', key: 'age_category', render: (age_category: string | null) => age_category || 'All Categories' },
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
        <Content style={{ padding: '16px', paddingBottom: '80px', paddingTop: '80px' }} className="md:px-6 md:pt-4">
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <Title level={2} style={{ margin: 0 }}>Results Management</Title>
              <Button 
                type="primary" 
                icon={<Trophy size={16} />}
                onClick={fetchWinners}
                loading={exportingWinners}
                disabled={exportingWinners}
              >
                View Winners
              </Button>
            </div>
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
                        backgroundColor: index < 3 ? '#f8fafc' : '#f9fafb',
                        overflow: 'hidden'
                      }}
                    >
                      {/* Participant Header */}
                      <div style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '16px',
                        backgroundColor: index < 3 ? '#8b5cf6' : '#6b7280',
                        color: 'white'
                      }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <div style={{
                            width: '36px',
                            height: '36px',
                            borderRadius: '50%',
                            backgroundColor: 'white',
                            color: index < 3 ? '#8b5cf6' : '#6b7280',
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
                                ? `${result.participant?.age_category} • ${result.participant?.church}`
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
                                    <Text style={{ fontSize: '14px', color: '#8b5cf6', fontWeight: 600 }}>
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

          {/* Winners Modal */}
          <Modal
            title={
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Trophy size={20} />
                <span>Winners Overview</span>
              </div>
            }
            open={viewingWinners}
            onCancel={() => {
              setViewingWinners(false);
              setWinnersData(null);
              setShowScoresForEvent({});
              setIndividualChampion(null);
            }}
            footer={[
              <Button key="cancel" onClick={() => {
                setViewingWinners(false);
                setWinnersData(null);
                setShowScoresForEvent({});
                setIndividualChampion(null);
              }}>
                Close
              </Button>,
              <Button 
                key="export" 
                type="primary" 
                icon={<Download size={16} />}
                onClick={exportWinners}
              >
                Export CSV
              </Button>
            ]}
            width={1200}
          >
            {winnersData && (
              <div>
                <div style={{ marginBottom: '20px', padding: '16px', backgroundColor: '#f8fafc', borderRadius: '8px' }}>
                  <Text strong style={{ fontSize: '16px', color: '#1e293b' }}>
                    Summary: {winnersData.events.length} Events • {winnersData.events.reduce((total, event) => total + event.winners.filter(w => w.rank <= 2).length, 0)} Winners
                  </Text>
                  {individualChampion && (
                    <div style={{ marginTop: '8px', fontSize: '14px', color: '#1890ff', fontWeight: 600 }}>
                      Individual Champion: {individualChampion.participant.full_name} (#{individualChampion.participant.chest_number}) - {individualChampion.participant.church} - {individualChampion.totalPoints} Points
                    </div>
                  )}
                  <div style={{ marginTop: '8px', fontSize: '14px', color: '#64748b' }}>
                    Generated on {new Date(winnersData.generated_at).toLocaleString()}
                  </div>
                </div>

                <div style={{ maxHeight: '600px', overflowY: 'auto' }}>
                  {winnersData.events.map((event, eventIndex) => (
                    <div
                      key={event.event_id}
                      style={{
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        marginBottom: '20px',
                        overflow: 'hidden',
                        backgroundColor: '#ffffff'
                      }}
                    >
                      {/* Event Header */}
                      <div style={{
                        padding: '16px',
                        backgroundColor: '#f1f5f9',
                        borderBottom: '1px solid #e2e8f0'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <Text strong style={{ fontSize: '16px', color: '#1e293b' }}>
                              {event.event_name}
                            </Text>
                            <div style={{ fontSize: '14px', color: '#64748b', marginTop: '4px' }}>
                              {event.event_type} • {event.age_category || 'All Categories'} • {event.winners.filter(w => w.rank <= 2).length} Winners
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <Button
                              type="text"
                              size="small"
                              icon={showScoresForEvent[event.event_id] ? <EyeOff size={14} /> : <Eye size={14} />}
                              onClick={() => setShowScoresForEvent(prev => ({
                                ...prev,
                                [event.event_id]: !prev[event.event_id]
                              }))}
                              style={{ 
                                color: showScoresForEvent[event.event_id] ? '#1890ff' : '#6b7280',
                                fontSize: '12px',
                                padding: '4px 8px',
                                height: 'auto'
                              }}
                            >
                              {showScoresForEvent[event.event_id] ? 'Hide Scores' : 'Show Scores'}
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Winners Table */}
                      <div style={{ padding: '16px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#f8fafc' }}>
                              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', fontSize: '14px', fontWeight: 600, color: '#374151' }}>Rank</th>
                              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', fontSize: '14px', fontWeight: 600, color: '#374151' }}>Participant</th>
                              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', fontSize: '14px', fontWeight: 600, color: '#374151' }}>Chest #</th>
                              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', fontSize: '14px', fontWeight: 600, color: '#374151' }}>Church</th>
                              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', fontSize: '14px', fontWeight: 600, color: '#374151' }}>District</th>
                              <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #e2e8f0', fontSize: '14px', fontWeight: 600, color: '#374151' }}>Total Score</th>
                              <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #e2e8f0', fontSize: '14px', fontWeight: 600, color: '#374151' }}>Average</th>
                            </tr>
                          </thead>
                          <tbody>
                            {event.winners.filter(winner => winner.rank <= 2).map((winner, winnerIndex) => (
                              <tr 
                                key={winnerIndex}
                                style={{ 
                                  backgroundColor: winnerIndex < 3 ? '#fefce8' : '#ffffff',
                                  borderBottom: winnerIndex < event.winners.length - 1 ? '1px solid #f1f5f9' : 'none'
                                }}
                              >
                                <td style={{ padding: '12px', textAlign: 'center' }}>
                                  <div style={{
                                    display: 'inline-flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                    width: '32px',
                                    height: '32px',
                                    borderRadius: '50%',
                                    backgroundColor: winner.rank === 1 ? '#fbbf24' : winner.rank === 2 ? '#e5e7eb' : winner.rank === 3 ? '#f59e0b' : '#f3f4f6',
                                    color: winner.rank <= 3 ? '#1f2937' : '#6b7280',
                                    fontSize: '14px',
                                    fontWeight: 'bold'
                                  }}>
                                    {winner.rank}
                                  </div>
                                </td>
                                <td style={{ padding: '12px' }}>
                                  <div>
                                    <div style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937' }}>
                                      {winner.participant.full_name}
                                    </div>
                                    {winner.tie_breaker_reason && (
                                      <div style={{ fontSize: '12px', color: '#f59e0b', marginTop: '2px' }}>
                                        Tie: {winner.tie_breaker_reason}
                                      </div>
                                    )}
                                  </div>
                                </td>
                                <td style={{ padding: '12px', fontSize: '14px', color: '#6b7280' }}>
                                  #{winner.participant.chest_number}
                                </td>
                                <td style={{ padding: '12px', fontSize: '14px', color: '#374151' }}>
                                  {winner.participant.church}
                                </td>
                                <td style={{ padding: '12px', fontSize: '14px', color: '#374151' }}>
                                  {winner.participant.district}
                                </td>
                                <td style={{ padding: '12px', textAlign: 'center', fontSize: '14px', fontWeight: 600, color: '#1890ff' }}>
                                  {showScoresForEvent[event.event_id] ? winner.total_score.toFixed(1) : '***'}
                                </td>
                                <td style={{ padding: '12px', textAlign: 'center', fontSize: '14px', fontWeight: 600, color: '#1890ff' }}>
                                  {showScoresForEvent[event.event_id] ? winner.average_score.toFixed(1) : '***'}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  ))}

                  {/* Individual Champion Table */}
                  {individualChampion && (
                    <div
                      style={{
                        border: '1px solid #e2e8f0',
                        borderRadius: '12px',
                        marginTop: '20px',
                        overflow: 'hidden',
                        backgroundColor: '#ffffff'
                      }}
                    >
                      {/* Champion Header */}
                      <div style={{
                        padding: '16px',
                        backgroundColor: '#f1f5f9',
                        borderBottom: '1px solid #e2e8f0'
                      }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div>
                            <Text strong style={{ fontSize: '16px', color: '#1e293b' }}>
                              Individual Championship
                            </Text>
                            <div style={{ fontSize: '14px', color: '#64748b', marginTop: '4px' }}>
                              Overall Champion • 1 Winner
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                            <Button
                              type="text"
                              size="small"
                              icon={showScoresForEvent['champion'] ? <EyeOff size={14} /> : <Eye size={14} />}
                              onClick={() => setShowScoresForEvent(prev => ({
                                ...prev,
                                'champion': !prev['champion']
                              }))}
                              style={{ 
                                color: showScoresForEvent['champion'] ? '#1890ff' : '#6b7280',
                                fontSize: '12px',
                                padding: '4px 8px',
                                height: 'auto'
                              }}
                            >
                              {showScoresForEvent['champion'] ? 'Hide Scores' : 'Show Scores'}
                            </Button>
                          </div>
                        </div>
                      </div>

                      {/* Champion Table */}
                      <div style={{ padding: '16px' }}>
                        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                          <thead>
                            <tr style={{ backgroundColor: '#f8fafc' }}>
                              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', fontSize: '14px', fontWeight: 600, color: '#374151' }}>Rank</th>
                              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', fontSize: '14px', fontWeight: 600, color: '#374151' }}>Participant</th>
                              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', fontSize: '14px', fontWeight: 600, color: '#374151' }}>Chest #</th>
                              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', fontSize: '14px', fontWeight: 600, color: '#374151' }}>Church</th>
                              <th style={{ padding: '12px', textAlign: 'left', borderBottom: '1px solid #e2e8f0', fontSize: '14px', fontWeight: 600, color: '#374151' }}>District</th>
                              <th style={{ padding: '12px', textAlign: 'center', borderBottom: '1px solid #e2e8f0', fontSize: '14px', fontWeight: 600, color: '#374151' }}>Total Points</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr style={{ backgroundColor: '#fefce8' }}>
                              <td style={{ padding: '12px', textAlign: 'center' }}>
                                <div style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  justifyContent: 'center',
                                  width: '32px',
                                  height: '32px',
                                  borderRadius: '50%',
                                  backgroundColor: '#fbbf24',
                                  color: '#1f2937',
                                  fontSize: '14px',
                                  fontWeight: 'bold'
                                }}>
                                  1
                                </div>
                              </td>
                              <td style={{ padding: '12px' }}>
                                <div>
                                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#1f2937' }}>
                                    {individualChampion.participant.full_name}
                                  </div>
                                </div>
                              </td>
                              <td style={{ padding: '12px', fontSize: '14px', color: '#6b7280' }}>
                                #{individualChampion.participant.chest_number}
                              </td>
                              <td style={{ padding: '12px', fontSize: '14px', color: '#374151' }}>
                                {individualChampion.participant.church}
                              </td>
                              <td style={{ padding: '12px', fontSize: '14px', color: '#374151' }}>
                                {individualChampion.participant.district}
                              </td>
                              <td style={{ padding: '12px', textAlign: 'center', fontSize: '14px', fontWeight: 600, color: '#1890ff' }}>
                                {showScoresForEvent['champion'] ? individualChampion.totalPoints : '***'}
                              </td>
                            </tr>
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
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