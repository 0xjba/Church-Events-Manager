// Notification utility functions
export interface NotificationData {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  tag?: string;
}

class NotificationService {
  private registration: ServiceWorkerRegistration | null = null;

  async init() {
    if ('serviceWorker' in navigator) {
      try {
        this.registration = await navigator.serviceWorker.register('/sw.js');
        console.log('Service Worker registered:', this.registration);
      } catch (error) {
        console.error('Service Worker registration failed:', error);
      }
    }
  }

  async requestPermission(): Promise<NotificationPermission> {
    if (!('Notification' in window)) {
      console.error('This browser does not support notifications');
      return 'denied';
    }

    if (Notification.permission === 'default') {
      return await Notification.requestPermission();
    }

    return Notification.permission;
  }

  async showNotification(data: NotificationData) {
    const permission = await this.requestPermission();
    
    if (permission !== 'granted') {
      console.warn('Notification permission not granted');
      return;
    }

    if (this.registration) {
      // Use service worker for better offline handling
      await this.registration.showNotification(data.title, {
        body: data.body,
        icon: data.icon || '/icon-192.png',
        badge: '/icon-192.png',
        tag: data.tag,
        data: { url: data.url }
      });
    } else {
      // Fallback to regular notification
      const notification = new Notification(data.title, {
        body: data.body,
        icon: data.icon || '/icon-192.png',
        tag: data.tag
      });

      if (data.url) {
        notification.onclick = () => {
          window.open(data.url, '_blank');
          notification.close();
        };
      }
    }
  }

  // Judge-specific notifications
  async notifyJudgeEventStart(eventName: string, eventId: string) {
    await this.showNotification({
      title: 'Event Starting Soon',
      body: `${eventName} is about to begin. Prepare for scoring.`,
      url: `/judge/score/${eventId}`,
      tag: `event-start-${eventId}`
    });
  }

  async notifyJudgeScoreReminder(eventName: string, eventId: string) {
    await this.showNotification({
      title: 'Score Submission Reminder',
      body: `Please submit your scores for ${eventName}`,
      url: `/judge/score/${eventId}`,
      tag: `score-reminder-${eventId}`
    });
  }

  // Participant notifications
  async notifyParticipantEventUpdate(eventName: string, message: string) {
    await this.showNotification({
      title: eventName,
      body: message,
      url: '/participant',
      tag: `participant-update-${Date.now()}`
    });
  }

  async notifyResultsPublished(eventName: string) {
    await this.showNotification({
      title: 'Results Published',
      body: `Results for ${eventName} are now available`,
      url: '/leaderboard',
      tag: `results-${eventName}`
    });
  }

  // Schedule local notifications (for reminders)
  scheduleNotification(data: NotificationData, delay: number) {
    setTimeout(() => {
      this.showNotification(data);
    }, delay);
  }
}

export const notificationService = new NotificationService();