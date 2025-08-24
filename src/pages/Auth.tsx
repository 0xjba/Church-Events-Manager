import { useState, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useParticipantAuth } from '@/hooks/useParticipantAuth';
import { Button, Input, Card, Form, Alert, Typography, Row, Col, Spin, message } from 'antd';
import { Trophy, Users, UserCheck, Gavel } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const { Title, Text } = Typography;

const Auth = () => {
  const { user: adminUser, signIn: adminSignIn, signUp: adminSignUp, loading: adminLoading } = useAuth();
  const { participant, signIn: participantSignIn, loading: participantLoading } = useParticipantAuth();
  const navigate = useNavigate();
  
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [userType, setUserType] = useState<'admin' | 'judge' | 'participant'>('admin');

  // Redirect authenticated users away from auth page
  useEffect(() => {
    if (adminUser && !adminLoading) {
      navigate('/', { replace: true });
    }
    if (participant && !participantLoading) {
      // Check if this is a judge or participant based on the participant object
      if (participant.role === 'judge') {
        navigate('/judge', { replace: true });
      } else {
        navigate('/participant', { replace: true });
      }
    }
  }, [adminUser, participant, adminLoading, participantLoading, navigate]);

  const handleAdminSignIn = async (values: { username: string; password: string }) => {
    setIsLoading(true);
    setError('');

    const { error } = await adminSignIn(values.username, values.password);
    
    if (error) {
      setError(error.message || 'Failed to sign in');
      message.error(error.message || 'Please check your credentials');
    } else {
      message.success('Signed in successfully!');
    }
    
    setIsLoading(false);
  };

  const handleJudgeSignIn = async (values: { username: string; password: string }) => {
    setIsLoading(true);
    setError('');

    const { error } = await participantSignIn(values.username, values.password);
    
    if (error) {
      setError(error.message || error || 'Failed to sign in');
      message.error(error.message || error || 'Please check your credentials');
    } else {
      message.success('Signed in successfully!');
      navigate('/judge', { replace: true });
    }
    
    setIsLoading(false);
  };

  const handleParticipantSignIn = async (values: { username: string; password: string }) => {
    setIsLoading(true);
    setError('');

    const { error } = await participantSignIn(values.username, values.password);
    
    if (error) {
      setError(error.message || error || 'Failed to sign in');
      message.error(error.message || error || 'Please check your credentials');
    } else {
      message.success('Signed in successfully!');
      navigate('/participant', { replace: true });
    }
    
    setIsLoading(false);
  };

  if (adminLoading || participantLoading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Spin size="large" />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ width: '100%', maxWidth: '400px' }}>
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px' }}>
            <img 
              src="/pypa-logo.png" 
              alt="PYPA Logo" 
              style={{ 
                width: 64, 
                height: 64, 
                borderRadius: '12px'
              }} 
            />
          </div>
          <Title level={2} style={{ margin: 0 }}>PYPA</Title>
          <Text type="secondary">Devotional & Cultural Competitions</Text>
        </div>

        {/* User Type Selection */}
        <Card style={{ marginBottom: '24px' }}>
          <Title level={4} style={{ textAlign: 'center', marginBottom: '8px' }}>Select Your Role</Title>
          <Text type="secondary" style={{ display: 'block', textAlign: 'center', marginBottom: '16px' }}>
            Choose your account type to continue
          </Text>
          
          <Row gutter={[8, 8]}>
            <Col span={8}>
              <Card
                hoverable
                size="small"
                style={{
                  textAlign: 'center',
                  border: userType === 'admin' ? '2px solid #8b5cf6' : '1px solid #d9d9d9',
                  backgroundColor: userType === 'admin' ? '#f8fafc' : 'white',
                }}
                onClick={() => setUserType('admin')}
              >
                <Users size={24} color="#8b5cf6" style={{ marginBottom: '4px' }} />
                <div style={{ fontWeight: 'medium', fontSize: '14px' }}>Admin</div>
                <Text type="secondary" style={{ fontSize: '11px' }}>System Admin</Text>
              </Card>
            </Col>
            <Col span={8}>
              <Card
                hoverable
                size="small"
                style={{
                  textAlign: 'center',
                  border: userType === 'judge' ? '2px solid #8b5cf6' : '1px solid #d9d9d9',
                  backgroundColor: userType === 'judge' ? '#f8fafc' : 'white',
                }}
                onClick={() => setUserType('judge')}
              >
                <Gavel size={24} color="#8b5cf6" style={{ marginBottom: '4px' }} />
                <div style={{ fontWeight: 'medium', fontSize: '14px' }}>Judge</div>
                <Text type="secondary" style={{ fontSize: '11px' }}>Event Judge</Text>
              </Card>
            </Col>
            <Col span={8}>
              <Card
                hoverable
                size="small"
                style={{
                  textAlign: 'center',
                  border: userType === 'participant' ? '2px solid #8b5cf6' : '1px solid #d9d9d9',
                  backgroundColor: userType === 'participant' ? '#f8fafc' : 'white',
                }}
                onClick={() => setUserType('participant')}
              >
                <UserCheck size={24} color="#8b5cf6" style={{ marginBottom: '4px' }} />
                <div style={{ fontWeight: 'medium', fontSize: '14px' }}>Participant</div>
                <Text type="secondary" style={{ fontSize: '11px' }}>Contestant</Text>
              </Card>
            </Col>
          </Row>
        </Card>

        {userType === 'admin' && (
          <Card>
            <Title level={4} style={{ marginBottom: '8px' }}>Admin Sign In</Title>
            <Text type="secondary" style={{ display: 'block', marginBottom: '16px' }}>
              Enter your admin credentials to access PYPA admin panel
            </Text>
            
            <Form onFinish={handleAdminSignIn} layout="vertical">
              <Form.Item
                label="Email"
                name="username"
                rules={[{ required: true, message: 'Please enter your email' }]}
              >
                <Input placeholder="Enter your email" />
              </Form.Item>
              
              <Form.Item
                label="Password"
                name="password"
                rules={[{ required: true, message: 'Please enter your password' }]}
              >
                <Input.Password placeholder="Enter your password" />
              </Form.Item>
              
              {error && (
                <Alert
                  message={error}
                  type="error"
                  style={{ marginBottom: '16px' }}
                />
              )}

              <Form.Item>
                <Button type="primary" htmlType="submit" loading={isLoading} block>
                  Sign In as Admin
                </Button>
              </Form.Item>
            </Form>

            <Alert
              message={
                <div>
                  <strong>Need an admin account?</strong> Contact your system administrator to create admin accounts.
                </div>
              }
              type="info"
              showIcon={false}
            />
          </Card>
        )}

        {userType === 'judge' && (
          <Card>
            <Title level={4} style={{ marginBottom: '8px' }}>Judge Sign In</Title>
            <Text type="secondary" style={{ display: 'block', marginBottom: '16px' }}>
              Enter your judge credentials to access PYPA judge panel
            </Text>
            
            <Form onFinish={handleJudgeSignIn} layout="vertical">
              <Form.Item
                label="Username"
                name="username"
                rules={[{ required: true, message: 'Please enter your username' }]}
              >
                <Input placeholder="Enter your username" />
              </Form.Item>
              
              <Form.Item
                label="Password"
                name="password"
                rules={[{ required: true, message: 'Please enter your password' }]}
              >
                <Input.Password placeholder="Enter your password" />
              </Form.Item>
              
              {error && (
                <Alert
                  message={error}
                  type="error"
                  style={{ marginBottom: '16px' }}
                />
              )}

              <Form.Item>
                <Button type="primary" htmlType="submit" loading={isLoading} block>
                  Sign In as Judge
                </Button>
              </Form.Item>
            </Form>

            <Alert
              message={
                <div>
                  <strong>Don't have judge credentials?</strong> Contact your administrator to create your judge account.
                </div>
              }
              type="info"
              showIcon={false}
            />
          </Card>
        )}

        {userType === 'participant' && (
          <Card>
            <Title level={4} style={{ marginBottom: '8px' }}>Participant Sign In</Title>
            <Text type="secondary" style={{ display: 'block', marginBottom: '16px' }}>
              Enter your participant credentials to access PYPA
            </Text>
            
            <Form onFinish={handleParticipantSignIn} layout="vertical">
              <Form.Item
                label="Username"
                name="username"
                rules={[{ required: true, message: 'Please enter your username' }]}
              >
                <Input placeholder="Enter your username" />
              </Form.Item>
              
              <Form.Item
                label="Password"
                name="password"
                rules={[{ required: true, message: 'Please enter your password' }]}
              >
                <Input.Password placeholder="Enter your password" />
              </Form.Item>
              
              {error && (
                <Alert
                  message={error}
                  type="error"
                  style={{ marginBottom: '16px' }}
                />
              )}

              <Form.Item>
                <Button type="primary" htmlType="submit" loading={isLoading} block>
                  Sign In
                </Button>
              </Form.Item>
            </Form>

            <Alert
              message={
                <div>
                  <strong>Don't have participant credentials?</strong> Contact your administrator to create your participant account.
                </div>
              }
              type="info"
              showIcon={false}
            />
          </Card>
        )}
      </div>
    </div>
  );
};

export default Auth;