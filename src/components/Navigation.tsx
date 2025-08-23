import { useAuth } from '@/hooks/useAuth';
import { Button, Menu, Layout, Avatar, Typography } from 'antd';
import { Trophy, Users, Calendar, BarChart3, Settings, LogOut, CalendarDays } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const { Sider } = Layout;
const { Text } = Typography;

const Navigation = () => {
  const { profile, signOut, isAdmin, isJudge } = useAuth();
  const location = useLocation();

  const navItems = [
    ...(isAdmin ? [
      { key: '/admin', icon: <Settings size={18} />, label: 'Dashboard', path: '/admin' },
      { key: '/admin/participants', icon: <Users size={18} />, label: 'Participants', path: '/admin/participants' },
      { key: '/admin/judges', icon: <Trophy size={18} />, label: 'Judges', path: '/admin/judges' },
      { key: '/admin/seasons', icon: <CalendarDays size={18} />, label: 'Seasons', path: '/admin/seasons' },
      { key: '/admin/events', icon: <Calendar size={18} />, label: 'Events', path: '/admin/events' },
      { key: '/admin/assignments', icon: <BarChart3 size={18} />, label: 'Assignments', path: '/admin/assignments' },
      { key: '/admin/results', icon: <Trophy size={18} />, label: 'Results', path: '/admin/results' },
    ] : []),
    ...(isJudge ? [
      { key: '/judge', icon: <Trophy size={18} />, label: 'My Events', path: '/judge' },
    ] : []),
  ];

  const menuItems = navItems.map(item => ({
    key: item.key,
    icon: item.icon,
    label: <Link to={item.path}>{item.label}</Link>,
  }));

  return (
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
          {profile?.full_name}
        </Text>
        <Text type="secondary" style={{ fontSize: '12px', textTransform: 'capitalize' }}>
          {profile?.role}
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
          onClick={signOut}
          style={{ width: '100%', justifyContent: 'flex-start' }}
        >
          Sign Out
        </Button>
      </div>

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
    </Sider>
  );
};

export default Navigation;