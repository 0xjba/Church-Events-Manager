import { useParticipantAuth } from '@/hooks/useParticipantAuth';
import Navigation from '@/components/Navigation';
import { Button, Card, Typography, Space, Layout } from 'antd';
import { Trophy, User, Calendar, LogOut, BarChart3 } from 'lucide-react';
import { Link } from 'react-router-dom';

const { Title, Text } = Typography;
const { Content } = Layout;

const ParticipantDashboard = () => {
  const { participant, signOut } = useParticipantAuth();

  if (!participant) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <Trophy size={48} style={{ color: '#bfbfbf', marginBottom: '16px' }} />
          <Text type="secondary">Not authenticated</Text>
        </div>
      </div>
    );
  }

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Navigation />
      <Layout className="md:ml-64">
        <Content style={{ padding: '16px', paddingBottom: '80px', paddingTop: '80px' }} className="md:px-6 md:pt-4">
          {/* Welcome Section */}
          <div style={{ marginBottom: '32px' }}>
            <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
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
              <Title level={2} style={{ marginBottom: '8px' }}>
                Welcome, {participant.full_name}!
              </Title>
            </div>
            <Text type="secondary">
              Chest Number: {participant.chest_number} | Category: {participant.category}
            </Text>
          </div>

          {/* Participant Info */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '24px', marginBottom: '32px' }}>
            <Card>
              <div style={{ marginBottom: '16px' }}>
                <Space align="center" style={{ marginBottom: '8px' }}>
                  <User size={20} />
                  <Title level={4} style={{ margin: 0 }}>My Profile</Title>
                </Space>
                <Text type="secondary" style={{ display: 'block' }}>Your participant information</Text>
              </div>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div>
                  <Text strong style={{ fontSize: '14px' }}>Name:</Text>
                  <div>
                    <Text type="secondary">{participant.full_name}</Text>
                  </div>
                </div>
                <div>
                  <Text strong style={{ fontSize: '14px' }}>Age:</Text>
                  <div>
                    <Text type="secondary">{participant.age} years</Text>
                  </div>
                </div>
                <div>
                  <Text strong style={{ fontSize: '14px' }}>Chest Number:</Text>
                  <div>
                    <Text type="secondary">{participant.chest_number}</Text>
                  </div>
                </div>
                <div>
                  <Text strong style={{ fontSize: '14px' }}>Category:</Text>
                  <div>
                    <Text type="secondary" style={{ textTransform: 'capitalize' }}>{participant.category}</Text>
                  </div>
                </div>
                <div>
                  <Text strong style={{ fontSize: '14px' }}>Church:</Text>
                  <div>
                    <Text type="secondary">{participant.church}</Text>
                  </div>
                </div>
                <div>
                  <Text strong style={{ fontSize: '14px' }}>District:</Text>
                  <div>
                    <Text type="secondary">{participant.district}</Text>
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <div style={{ marginBottom: '16px' }}>
                <Space align="center" style={{ marginBottom: '8px' }}>
                  <Calendar size={20} />
                  <Title level={4} style={{ margin: 0 }}>My Events</Title>
                </Space>
                <Text type="secondary" style={{ display: 'block' }}>Events you're registered for</Text>
              </div>
              
              <div style={{ textAlign: 'center', padding: '32px 0', color: '#6b7280' }}>
                <Calendar size={48} style={{ color: '#6b7280', marginBottom: '16px' }} />
                <div>No events registered yet</div>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  Check back later for upcoming events
                </Text>
              </div>
            </Card>

                         <Card>
               <div style={{ marginBottom: '16px' }}>
                 <Space align="center" style={{ marginBottom: '8px' }}>
                   <BarChart3 size={20} />
                   <Title level={4} style={{ margin: 0 }}>My Results</Title>
                 </Space>
                 <Text type="secondary" style={{ display: 'block' }}>Your performance and scores</Text>
               </div>
               
                             <div style={{ textAlign: 'center', padding: '32px 0', color: '#6b7280' }}>
                <BarChart3 size={48} style={{ color: '#6b7280', marginBottom: '16px' }} />
                <div>No results available</div>
                <Text type="secondary" style={{ fontSize: '12px' }}>
                  Results will appear here after events
                </Text>
              </div>
             </Card>
           </div>

           {/* Quick Actions */}
           <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
             <Link to="/leaderboard" style={{ textDecoration: 'none' }}>
               <Card 
                 hoverable
                 style={{ height: '100%', cursor: 'pointer' }}
               >
                 <Space align="center" style={{ marginBottom: '8px' }}>
                   <BarChart3 size={20} />
                   <Title level={4} style={{ margin: 0 }}>View Leaderboard</Title>
                 </Space>
                 <Text type="secondary" style={{ display: 'block' }}>Check rankings and results</Text>
               </Card>
             </Link>
           </div>
        </Content>
      </Layout>
    </Layout>
  );
};

export default ParticipantDashboard;