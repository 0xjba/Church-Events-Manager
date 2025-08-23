import { useAuth } from '@/hooks/useAuth';
import Navigation from '@/components/Navigation';
import { Layout, Card, Statistic, Row, Col, Typography, Button } from 'antd';
import { Users, Calendar, Trophy, BarChart3, LogOut } from 'lucide-react';
import { PWAInstallPrompt } from '@/components/PWAInstallPrompt';
import { NetworkStatus } from '@/components/NetworkStatus';

const { Content, Header } = Layout;
const { Title, Text } = Typography;

const AdminDashboard = () => {
  const { profile, signOut } = useAuth();

  const stats = [
    {
      title: 'Total Participants',
      value: 0,
      description: 'Registered participants',
      icon: <Users size={24} color="#1890ff" />,
    },
    {
      title: 'Active Events',
      value: 0,
      description: 'Events in progress',
      icon: <Calendar size={24} color="#52c41a" />,
    },
    {
      title: 'Judges',
      value: 0,
      description: 'Assigned judges',
      icon: <Trophy size={24} color="#8b5cf6" />,
    },
    {
      title: 'Completed Events',
      value: 0,
      description: 'Events finished',
      icon: <BarChart3 size={24} color="#fa8c16" />,
    }
  ];

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Navigation />
      
      <Layout style={{ marginLeft: '256px' }}>
        {/* Mobile header */}
        <Header 
          className="md:hidden" 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            justifyContent: 'space-between',
            padding: '0 16px',
            background: '#fff',
            borderBottom: '1px solid #f0f0f0'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center' }}>
            <Trophy size={24} color="#8b5cf6" style={{ marginRight: '8px' }} />
            <div>
              <Text strong style={{ fontSize: '18px' }}>PYPA</Text>
              <div>
                <Text type="secondary" style={{ fontSize: '14px' }}>
                  {profile?.full_name}
                </Text>
              </div>
            </div>
          </div>
          <Button
            type="text"
            icon={<LogOut size={16} />}
            onClick={signOut}
          >
            Sign Out
          </Button>
        </Header>
        
        <Content style={{ padding: '16px 24px', paddingBottom: '80px' }}>
          <div style={{ marginBottom: '24px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
              <Title level={2} style={{ margin: 0 }}>
                Admin Dashboard
              </Title>
              <NetworkStatus />
            </div>
            <Text type="secondary">
              Welcome back, {profile?.full_name}
            </Text>
          </div>

          <PWAInstallPrompt />

          <Row gutter={[16, 16]} style={{ marginBottom: '24px' }}>
            {stats.map((stat, index) => (
              <Col xs={24} sm={12} lg={6} key={index}>
                <Card>
                  <Statistic
                    title={stat.title}
                    value={stat.value}
                    prefix={stat.icon}
                  />
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    {stat.description}
                  </Text>
                </Card>
              </Col>
            ))}
          </Row>

          <Row gutter={[24, 24]}>
            <Col xs={24} lg={12}>
              <Card>
                <Title level={4}>Recent Activity</Title>
                <Text type="secondary" style={{ display: 'block', marginBottom: '16px' }}>
                  Latest updates and changes
                </Text>
                <div style={{ textAlign: 'center', padding: '32px 0', color: '#999' }}>
                  No recent activity
                </div>
              </Card>
            </Col>

            <Col xs={24} lg={12}>
              <Card>
                <Title level={4}>Quick Actions</Title>
                <Text type="secondary" style={{ display: 'block', marginBottom: '16px' }}>
                  Common tasks and shortcuts
                </Text>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <Card 
                    size="small" 
                    hoverable 
                    onClick={() => window.location.href = '/admin/events'}
                    style={{ cursor: 'pointer' }}
                  >
                    <div style={{ fontWeight: 'medium' }}>Add New Event</div>
                    <Text type="secondary" style={{ fontSize: '12px' }}>Create a new competition event</Text>
                  </Card>
                  <Card 
                    size="small" 
                    hoverable 
                    onClick={() => window.location.href = '/admin/participants'}
                    style={{ cursor: 'pointer' }}
                  >
                    <div style={{ fontWeight: 'medium' }}>Register Participant</div>
                    <Text type="secondary" style={{ fontSize: '12px' }}>Add a new participant</Text>
                  </Card>
                  <Card 
                    size="small" 
                    hoverable 
                    onClick={() => window.location.href = '/admin/assignments'}
                    style={{ cursor: 'pointer' }}
                  >
                    <div style={{ fontWeight: 'medium' }}>Assign Judge</div>
                    <Text type="secondary" style={{ fontSize: '12px' }}>Assign judges to events</Text>
                  </Card>
                </div>
              </Card>
            </Col>
          </Row>
        </Content>
      </Layout>
    </Layout>
  );
};

export default AdminDashboard;