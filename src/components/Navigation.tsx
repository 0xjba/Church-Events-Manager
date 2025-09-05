import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useParticipantAuth } from '@/hooks/useParticipantAuth';
import { Button, Menu, Layout, Avatar, Typography, Modal, Card, Space, Divider } from 'antd';
import { Trophy, Users, Calendar, BarChart3, Settings, LogOut, CalendarDays, User, Gavel } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';

const { Sider } = Layout;
const { Text, Title } = Typography;

const Navigation = () => {
  const { profile, signOut: adminSignOut, isAdmin, isJudge } = useAuth();
  const { participant, signOut: participantSignOut } = useParticipantAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [profileModalVisible, setProfileModalVisible] = useState(false);
  const [judgeData, setJudgeData] = useState<any>(null);

  // Determine user info and role
  const currentUser = profile || participant;
  const currentRole = profile?.role || participant?.role;
  const isCurrentUserAdmin = currentRole === 'admin';
  const isCurrentUserJudge = currentRole === 'judge';

  // Fetch judge-specific data when user is a judge
  useEffect(() => {
    const fetchJudgeData = async () => {
      if (isCurrentUserJudge && profile?.user_id) {
        try {
          const { data, error } = await supabase
            .from('judges')
            .select('*')
            .eq('id', profile.user_id)
            .single();
          
          if (!error && data) {
            setJudgeData(data);
          }
        } catch (error) {
          console.error('Error fetching judge data:', error);
        }
      }
    };

    fetchJudgeData();
  }, [isCurrentUserJudge, profile?.user_id]);

  const navItems = [
    ...(isCurrentUserAdmin ? [
      { key: '/admin', icon: <Settings size={18} />, label: 'Dashboard', path: '/admin' },
      { key: '/admin/participants', icon: <Users size={18} />, label: 'Participants', path: '/admin/participants' },
      { key: '/admin/judges', icon: <Gavel size={18} />, label: 'Judges', path: '/admin/judges' },
      { key: '/admin/event-levels', icon: <CalendarDays size={18} />, label: 'Event Levels', path: '/admin/event-levels' },
      { key: '/admin/events', icon: <Calendar size={18} />, label: 'Events', path: '/admin/events' },
      { key: '/admin/results', icon: <Trophy size={18} />, label: 'Results', path: '/admin/results' },
    ] : []),
    ...(isCurrentUserJudge ? [
      { key: '/judge', icon: <Trophy size={18} />, label: 'My Events', path: '/judge' },
    ] : []),
    ...(currentRole === 'participant' ? [
      { key: '/participant', icon: <User size={18} />, label: 'Dashboard', path: '/participant' },
    ] : []),
  ];

  const menuItems = navItems.map(item => ({
    key: item.key,
    icon: item.icon,
    label: <Link to={item.path}>{item.label}</Link>,
  }));

  const handleSignOut = () => {
    if (profile) {
      adminSignOut();
    } else if (participant) {
      participantSignOut();
    }
    navigate('/auth');
    setProfileModalVisible(false);
  };

  const getInitials = (name: string) => {
    return name
      .split(' ')
      .map(word => word.charAt(0))
      .join('')
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <>
      {/* Mobile Header - Trophy Icon + PYPA + Profile Avatar */}
      <Layout.Header
        className="flex items-center justify-between px-4 bg-white border-b md:hidden"
        style={{ height: 64, lineHeight: 'normal', position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000 }}
      >
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
          <Text strong style={{ fontSize: '18px' }}>PYPA</Text>
        </div>
        
        <Avatar
          size={36}
          style={{ 
            backgroundColor: '#8b5cf6', 
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
          onClick={() => setProfileModalVisible(true)}
        >
          {currentUser?.full_name ? getInitials(currentUser.full_name) : <User size={18} />}
        </Avatar>
      </Layout.Header>

      {/* Profile Modal */}
      <Modal
        open={profileModalVisible}
        onCancel={() => setProfileModalVisible(false)}
        footer={null}
        width={360}
        centered
        destroyOnClose
      >
        <div style={{ padding: '8px' }}>
          {/* Header Section */}
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '16px' }}>
              <Avatar
                size={80}
                style={{ 
                  backgroundColor: '#8b5cf6', 
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                {currentUser?.full_name ? getInitials(currentUser.full_name) : <User size={32} />}
              </Avatar>
            </div>
            <Title level={4} style={{ margin: '8px 0 4px 0', fontSize: '18px' }}>
              {currentUser?.full_name || 'User'}
            </Title>
            <Text type="secondary" style={{ 
              textTransform: 'capitalize', 
              fontSize: '14px',
              display: 'block'
            }}>
              {currentRole || 'User'}
            </Text>
          </div>
          
          <Divider style={{ margin: '16px 0' }} />
          
          {/* Role-Specific Details */}
          <div style={{ marginBottom: '24px' }}>
            {currentRole === 'participant' && participant && (
              <div style={{ display: 'grid', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text type="secondary" style={{ fontSize: '13px' }}>Church:</Text>
                  <Text strong style={{ fontSize: '13px' }}>{participant.church}</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text type="secondary" style={{ fontSize: '13px' }}>District:</Text>
                  <Text strong style={{ fontSize: '13px' }}>{participant.district}</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text type="secondary" style={{ fontSize: '13px' }}>Category:</Text>
                  <Text strong style={{ fontSize: '13px', textTransform: 'capitalize' }}>{participant.category}</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text type="secondary" style={{ fontSize: '13px' }}>Age:</Text>
                  <Text strong style={{ fontSize: '13px' }}>{participant.age} years</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text type="secondary" style={{ fontSize: '13px' }}>Chest Number:</Text>
                  <Text strong style={{ fontSize: '13px' }}>#{participant.chest_number}</Text>
                </div>
              </div>
            )}
            
            {currentRole === 'judge' && (profile || judgeData) && (
              <div style={{ display: 'grid', gap: '12px' }}>
                {judgeData?.church && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text type="secondary" style={{ fontSize: '13px' }}>Church:</Text>
                    <Text strong style={{ fontSize: '13px' }}>{judgeData.church}</Text>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text type="secondary" style={{ fontSize: '13px' }}>Email:</Text>
                  <Text strong style={{ fontSize: '13px' }}>{profile?.email}</Text>
                </div>
                {judgeData?.contact && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text type="secondary" style={{ fontSize: '13px' }}>Contact:</Text>
                    <Text strong style={{ fontSize: '13px' }}>{judgeData.contact}</Text>
                  </div>
                )}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text type="secondary" style={{ fontSize: '13px' }}>Status:</Text>
                  <Text strong style={{ fontSize: '13px', textTransform: 'capitalize' }}>
                    {judgeData?.is_active ? 'Active' : 'Inactive'}
                  </Text>
                </div>
                {judgeData?.last_login && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text type="secondary" style={{ fontSize: '13px' }}>Last Login:</Text>
                    <Text strong style={{ fontSize: '13px' }}>
                      {new Date(judgeData.last_login).toLocaleDateString()}
                    </Text>
                  </div>
                )}
              </div>
            )}
            
            {currentRole === 'admin' && profile && (
              <div style={{ display: 'grid', gap: '12px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text type="secondary" style={{ fontSize: '13px' }}>Email:</Text>
                  <Text strong style={{ fontSize: '13px' }}>{profile.email}</Text>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <Text type="secondary" style={{ fontSize: '13px' }}>Username:</Text>
                  <Text strong style={{ fontSize: '13px' }}>{profile.username}</Text>
                </div>
                {profile.last_login && (
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <Text type="secondary" style={{ fontSize: '13px' }}>Last Login:</Text>
                    <Text strong style={{ fontSize: '13px' }}>
                      {new Date(profile.last_login).toLocaleDateString()}
                    </Text>
                  </div>
                )}
              </div>
            )}
          </div>
          
          <Divider style={{ margin: '16px 0' }} />
          
          {/* Sign Out Button */}
          <Button
            type="text"
            icon={<LogOut size={16} />}
            onClick={handleSignOut}
            style={{ 
              width: '100%', 
              justifyContent: 'center',
              height: '40px',
              fontSize: '14px',
              color: '#ff4d4f',
              border: '1px solid #ff4d4f'
            }}
          >
            Sign Out
          </Button>
        </div>
      </Modal>

      {/* Desktop Sidebar */}
      <Sider 
        width={256} 
        theme="light"
        className="hidden md:block"
        style={{ 
          height: '100vh', 
          position: 'fixed', 
          left: 0, 
          top: 0,
          borderRight: '1px solid #f0f0f0'
        }}
      >
        <div style={{ padding: '16px', borderBottom: '1px solid #f0f0f0' }}>
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: '8px' }}>
            <img 
              src="/pypa-logo.png" 
              alt="PYPA Logo" 
              style={{ 
                width: 28, 
                height: 28, 
                borderRadius: '6px',
                marginRight: '10px'
              }} 
            />
            <Text strong style={{ fontSize: '18px' }}>PYPA</Text>
          </div>
          <Text type="secondary" style={{ fontSize: '14px', display: 'block' }}>
            {currentUser?.full_name}
          </Text>
          <Text type="secondary" style={{ fontSize: '12px', textTransform: 'capitalize' }}>
            {currentRole}
          </Text>
        </div>

        <Menu
          mode="inline"
          selectedKeys={[location.pathname]}
          items={menuItems}
          style={{ border: 'none' }}
        />

        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, padding: '16px', borderTop: '1px solid #f0f0f0' }}>
          <Button
            type="text"
            icon={<LogOut size={16} />}
            onClick={handleSignOut}
            style={{ width: '100%', justifyContent: 'flex-start' }}
          >
            Sign Out
          </Button>
        </div>
      </Sider>

      {/* Mobile Navigation (Bottom Bar) */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t z-50">
        <div style={{ display: 'flex', height: '64px' }}>
          {navItems.map((item) => (
            <Link
              key={item.key}
              to={item.path}
              style={{
                flex: 1,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px',
                textDecoration: 'none',
                color: location.pathname === item.path ? '#8b5cf6' : '#666',
                backgroundColor: location.pathname === item.path ? '#f3f0ff' : 'transparent',
              }}
            >
              {item.icon}
            </Link>
          ))}
        </div>
      </div>
    </>
  );
};

export default Navigation;