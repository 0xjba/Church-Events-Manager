import { useAuth } from '@/hooks/useAuth';
import { useParticipantAuth } from '@/hooks/useParticipantAuth';
import { Button, Menu, Layout, Avatar, Typography } from 'antd';
import { Trophy, Users, Calendar, BarChart3, Settings, LogOut, CalendarDays } from 'lucide-react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

const { Sider } = Layout;
const { Text } = Typography;

const Navigation = () => {
  const { profile, signOut: adminSignOut, isAdmin, isJudge } = useAuth();
  const { participant, signOut: participantSignOut } = useParticipantAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Determine user info and role
  const currentUser = profile || participant;
  const currentRole = profile?.role || participant?.role;
  const isCurrentUserAdmin = currentRole === 'admin';
  const isCurrentUserJudge = currentRole === 'judge';

  const navItems = [
    ...(isCurrentUserAdmin ? [
      { key: '/admin', icon: <Settings size={18} />, label: 'Dashboard', path: '/admin' },
      { key: '/admin/participants', icon: <Users size={18} />, label: 'Participants', path: '/admin/participants' },
      { key: '/admin/judges', icon: <Trophy size={18} />, label: 'Judges', path: '/admin/judges' },
      { key: '/admin/seasons', icon: <CalendarDays size={18} />, label: 'Seasons', path: '/admin/seasons' },
      { key: '/admin/events', icon: <Calendar size={18} />, label: 'Events', path: '/admin/events' },

      { key: '/admin/results', icon: <Trophy size={18} />, label: 'Results', path: '/admin/results' },
    ] : []),
    ...(isCurrentUserJudge ? [
      { key: '/judge', icon: <Trophy size={18} />, label: 'My Events', path: '/judge' },
    ] : []),
  ];

  const menuItems = navItems.map(item => ({
    key: item.key,
    icon: item.icon,
    label: <Link to={item.path}>{item.label}</Link>,
  }));

  return (
    <>
      {/* Mobile Header - Simple App Name */}
      <Layout.Header
        className="flex items-center justify-center px-4 bg-white border-b md:hidden"
        style={{ height: 64, lineHeight: 'normal', position: 'fixed', top: 0, left: 0, right: 0, zIndex: 1000 }}
      >
        <Text strong className="text-lg">PYPA</Text>
      </Layout.Header>

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
            <Trophy size={24} style={{ color: '#8b5cf6', marginRight: '8px' }} />
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
            onClick={() => {
              if (profile) {
                adminSignOut();
              } else if (participant) {
                participantSignOut();
              }
              navigate('/auth');
            }}
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
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '8px',
                textDecoration: 'none',
                color: location.pathname === item.path ? '#8b5cf6' : '#666',
                backgroundColor: location.pathname === item.path ? '#f3f0ff' : 'transparent',
              }}
            >
              {item.icon}
              <Text style={{ fontSize: '12px', marginTop: '4px', color: 'inherit' }}>
                {item.label}
              </Text>
            </Link>
          ))}
        </div>
      </div>
    </>
  );
};

export default Navigation;