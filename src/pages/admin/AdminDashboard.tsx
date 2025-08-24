import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useAdminStats } from '@/hooks/useAdminStats';
import { useRecentActivity } from '@/hooks/useRecentActivity';
import Navigation from '@/components/Navigation';
import { Layout, Card, Statistic, Row, Col, Typography, Button, Spin, Alert, List, Avatar, Tag } from 'antd';
import { Users, Calendar, Trophy, BarChart3, LogOut, RefreshCw, User, Award, Target, Clock } from 'lucide-react';
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt';
import { NetworkStatus } from '@/components/NetworkStatus';

const { Content, Header } = Layout;
const { Title, Text } = Typography;

const AdminDashboard = () => {
  const { profile, signOut } = useAuth();
  const { stats, loading, error, refetch } = useAdminStats();
  const { activities, loading: activitiesLoading, error: activitiesError, refetch: refetchActivities } = useRecentActivity();
  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());

  const statsData = [
    {
      title: 'Total Participants',
      value: stats.totalParticipants,
      description: 'Registered participants',
      icon: <Users size={24} color="#8b5cf6" />,
    },
    {
      title: 'Active Events',
      value: stats.activeEvents,
      description: 'Events in progress',
      icon: <Calendar size={24} color="#8b5cf6" />,
    },
    {
      title: 'Judges',
      value: stats.totalJudges,
      description: 'Assigned judges',
      icon: <Trophy size={24} color="#8b5cf6" />,
    },
    {
      title: 'Completed Events',
      value: stats.completedEvents,
      description: 'Events finished',
      icon: <BarChart3 size={24} color="#8b5cf6" />,
    }
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Navigation />
      
      <Layout className="md:ml-64">
        
        <Content style={{ padding: '16px', paddingBottom: '80px', paddingTop: '80px' }} className="md:px-6 md:pt-4">
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <Title level={2} style={{ margin: 0 }}>
                Admin Dashboard
              </Title>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <Button 
                  icon={<RefreshCw size={16} />} 
                  onClick={() => {
                    refetch();
                    refetchActivities();
                    setLastUpdated(new Date());
                  }}
                  loading={loading || activitiesLoading}
                  size="small"
                  type="default"
                  style={{ 
                    borderRadius: '6px',
                    border: '1px solid #d9d9d9',
                    boxShadow: '0 2px 0 rgba(0, 0, 0, 0.02)',
                    height: '32px',
                    padding: '4px 12px'
                  }}
                >
                  Refresh
                </Button>
                <NetworkStatus />
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
              <Text type="secondary">
                Welcome back, {profile?.full_name}
              </Text>
              <Tag 
                icon={<Clock size={12} />} 
                color="blue"
                style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
              >
                Last updated: {lastUpdated.toLocaleTimeString()}
              </Tag>
            </div>
          </div>

          <PWAInstallPrompt />

          {(error || activitiesError) && (
            <Alert
              message="Error loading data"
              description={error || activitiesError}
              type="error"
              showIcon
              style={{ marginBottom: '16px' }}
                                action={
                    <Button size="small" onClick={() => {
                      refetch();
                      refetchActivities();
                      setLastUpdated(new Date());
                    }}>
                      Retry
                    </Button>
                  }
            />
          )}

          <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
            {statsData.map((stat, index) => (
              <Col xs={24} sm={12} lg={6} key={index}>
                <Card>
                  <Spin spinning={loading} tip="Loading...">
                    <Statistic
                      title={stat.title}
                      value={loading ? '-' : stat.value}
                      prefix={stat.icon}
                      valueStyle={{ color: loading ? '#d9d9d9' : undefined }}
                    />
                    <Text type="secondary" style={{ fontSize: '12px' }}>
                      {stat.description}
                    </Text>
                  </Spin>
                </Card>
              </Col>
            ))}
          </Row>

          {/* Additional Statistics Row */}
          <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
            <Col xs={24} sm={12} lg={12}>
              <Card>
                <Spin spinning={loading} tip="Loading...">
                  <Statistic
                    title="Total Events"
                    value={loading ? '-' : stats.totalEvents}
                    prefix={<Calendar size={24} color="#8b5cf6" />}
                    valueStyle={{ color: loading ? '#d9d9d9' : undefined }}
                  />
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    All events created
                  </Text>
                </Spin>
              </Card>
            </Col>
          </Row>

          <Row gutter={[24, 24]}>
            <Col xs={24}>
              <Card>
                <Title level={4}>Recent Activity</Title>
                <Text type="secondary" style={{ display: 'block', marginBottom: '16px' }}>
                  Latest updates and changes
                </Text>
                <Spin spinning={activitiesLoading}>
                  {activities.length > 0 ? (
                    <List
                      dataSource={activities}
                      renderItem={(activity) => {
                        const getIcon = () => {
                          switch (activity.type) {
                            case 'event':
                              return <Calendar size={16} color="#8b5cf6" />;
                            case 'participant':
                              return <User size={16} color="#8b5cf6" />;
                            case 'judge':
                              return <Award size={16} color="#8b5cf6" />;
                            case 'score':
                              return <Target size={16} color="#8b5cf6" />;
                            default:
                              return <Calendar size={16} color="#8b5cf6" />;
                          }
                        };

                        const getActionColor = () => {
                          switch (activity.action) {
                            case 'created':
                            case 'registered':
                              return '#8b5cf6';
                            case 'completed':
                              return '#6b7280';
                            case 'submitted':
                              return '#8b5cf6';
                            default:
                              return '#6b7280';
                          }
                        };

                        return (
                          <List.Item>
                            <List.Item.Meta
                              avatar={
                                <Avatar 
                                  icon={getIcon()} 
                                  style={{ backgroundColor: getActionColor() }}
                                />
                              }
                              title={activity.title}
                              description={
                                <div>
                                  <div>{activity.description}</div>
                                  <Text type="secondary" style={{ fontSize: '12px' }}>
                                    {new Date(activity.timestamp).toLocaleDateString()} at{' '}
                                    {new Date(activity.timestamp).toLocaleTimeString()}
                                  </Text>
                                </div>
                              }
                            />
                          </List.Item>
                        );
                      }}
                    />
                  ) : (
                    <div style={{ textAlign: 'center', padding: '32px 0', color: '#6b7280' }}>
                      No recent activity
                    </div>
                  )}
                </Spin>
              </Card>
            </Col>


          </Row>
        </Content>
      </Layout>
    </Layout>
  );
};

export default AdminDashboard;