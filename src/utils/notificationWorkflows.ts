import { notificationService } from './notifications';
import { supabase } from '@/integrations/supabase/client';

export class NotificationWorkflows {
  // Judge notifications
  static async notifyJudgeEventStart(eventId: string, judgeId: string) {
    const { data: event } = await supabase
      .from('events')
      .select('name')
      .eq('id', eventId)
      .single();

    if (event) {
      await notificationService.notifyJudgeEventStart(event.name, eventId);
    }
  }

  static async notifyJudgeScoreReminder(eventId: string, judgeId: string) {
    const { data: event } = await supabase
      .from('events')
      .select('name')
      .eq('id', eventId)
      .single();

    if (event) {
      await notificationService.notifyJudgeScoreReminder(event.name, eventId);
    }
  }

  // Participant notifications
  static async notifyParticipantResultsPublished(eventId: string) {
    const { data: event } = await supabase
      .from('events')
      .select('name')
      .eq('id', eventId)
      .single();

    if (event) {
      await notificationService.notifyResultsPublished(event.name);
    }
  }

  static async notifyParticipantEventUpdate(eventId: string, message: string) {
    const { data: event } = await supabase
      .from('events')
      .select('name')
      .eq('id', eventId)
      .single();

    if (event) {
      await notificationService.notifyParticipantEventUpdate(event.name, message);
    }
  }

  // Schedule reminders for judges before events
  static async scheduleJudgeReminders(eventId: string, startTime: Date) {
    const { data: judges } = await supabase
      .from('event_judges')
      .select('judge_id, judges(full_name)')
      .eq('event_id', eventId);

    if (judges) {
      // Schedule 30 minutes before event
      const reminderTime = new Date(startTime.getTime() - 30 * 60 * 1000);
      const delay = reminderTime.getTime() - Date.now();

      if (delay > 0) {
        for (const judge of judges) {
          notificationService.scheduleNotification({
            title: "Event Starting Soon",
            body: "Your judging assignment starts in 30 minutes",
            url: `/judge/scoring/${eventId}`,
            icon: "/icon-192.png"
          }, delay);
        }
      }
    }
  }
}

export const notificationWorkflows = NotificationWorkflows;