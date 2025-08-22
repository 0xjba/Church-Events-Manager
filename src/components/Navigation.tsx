import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Trophy, Users, Calendar, BarChart3, Settings, LogOut } from 'lucide-react';
import { Link, useLocation } from 'react-router-dom';

const Navigation = () => {
  const { profile, signOut, isAdmin, isJudge, isParticipant } = useAuth();
  const location = useLocation();

  const navItems = [
    ...(isAdmin ? [
      { href: '/admin', icon: Settings, label: 'Dashboard', exact: true },
      { href: '/admin/participants', icon: Users, label: 'Participants', exact: true },
      { href: '/admin/judges', icon: Trophy, label: 'Judges', exact: true },
      { href: '/admin/events', icon: Calendar, label: 'Events', exact: true },
      { href: '/admin/assignments', icon: BarChart3, label: 'Assignments', exact: true },
      { href: '/admin/results', icon: Trophy, label: 'Results', exact: true },
    ] : []),
    ...(isJudge ? [
      { href: '/judge', icon: Trophy, label: 'My Events', exact: false },
    ] : []),
    ...(isParticipant ? [
      { href: '/participant', icon: Trophy, label: 'My Events', exact: false },
      { href: '/leaderboard', icon: BarChart3, label: 'Leaderboard', exact: true },
    ] : []),
  ];

  const isActive = (href: string, exact: boolean) => {
    if (exact) {
      return location.pathname === href;
    }
    return location.pathname.startsWith(href);
  };

  return (
    <nav className="bg-card border-t border-border fixed bottom-0 left-0 right-0 z-50 md:relative md:border-t-0 md:border-r">
      <div className="flex md:flex-col h-20 md:h-auto">
        {/* Mobile header - hidden on mobile as it's in bottom nav */}
        <div className="hidden md:block mobile-padding border-b border-border">
          <div className="flex items-center space-x-3">
            <Trophy className="h-6 w-6 sm:h-7 sm:w-7 text-primary" />
            <span className="font-bold text-responsive-lg">PYPA</span>
          </div>
          <p className="text-responsive-sm text-muted-foreground mt-2">
            {profile?.full_name}
          </p>
          <p className="text-responsive-xs text-muted-foreground capitalize">
            {profile?.role}
          </p>
        </div>

        {/* Navigation items */}
        <div className="flex md:flex-col flex-1 overflow-hidden">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isActive(item.href, item.exact);
            
            return (
              <Link
                key={item.href}
                to={item.href}
                className={`flex flex-col md:flex-row items-center justify-center md:justify-start space-y-1 md:space-y-0 md:space-x-3 px-2 py-3 md:px-4 md:py-4 flex-1 md:flex-none transition-colors touch-target ${
                  active
                    ? 'text-primary bg-primary/10 border-t-2 md:border-t-0 md:border-r-2 border-primary'
                    : 'text-muted-foreground hover:text-foreground hover:bg-accent'
                }`}
              >
                <Icon className="h-5 w-5 md:h-4 md:w-4" />
                <span className="text-xs md:text-responsive-sm font-medium">
                  {item.label}
                </span>
              </Link>
            );
          })}
        </div>

        {/* Sign out button - desktop only */}
        <div className="hidden md:block mobile-padding border-t border-border">
          <Button
            variant="ghost"
            onClick={signOut}
            className="w-full justify-start text-muted-foreground hover:text-foreground h-12 text-responsive-sm"
          >
            <LogOut className="h-4 w-4 mr-3" />
            Sign Out
          </Button>
        </div>
      </div>
    </nav>
  );
};

export default Navigation;