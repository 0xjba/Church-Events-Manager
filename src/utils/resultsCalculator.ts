import { supabase } from '@/integrations/supabase/client';
import type { SupabaseRow } from '@/lib/types';

export interface ScoreData {
  id: string;
  participant_id?: string;
  group_id?: string;
  judge_id: string;
  criteria_id: string;
  score: number;
  is_locked: boolean;
}

export interface CriteriaData {
  id: string;
  name: string;
  max_score: number;
  weight: number;
}

export interface ParticipantData {
  id: string;
  full_name: string;
  chest_number: string;
  age_category?: string | null;
  church: string;
  district: string;
}

export interface GroupData {
  id: string;
  name: string;
  description: string | null;
  members?: Array<{
    participant: {
      full_name: string;
      chest_number: string;
      church: string;
    };
  }>;
}

export interface ResultData {
  participant_id?: string;
  group_id?: string;
  participant?: ParticipantData;
  group?: GroupData;
  criteria_scores: { [criteriaId: string]: number }; // Average score per criteria
  weighted_scores: { [criteriaId: string]: number }; // Weighted score per criteria
  total_score: number;
  average_score: number;
  rank: number;
  tie_breaker_reason?: string;
}

export interface EventResults {
  event_id: string;
  results: ResultData[];
  total_participants: number;
  criteria: CriteriaData[];
  last_calculated: Date;
  /** Entered but never scored by anyone — they did not compete. */
  absentees: Array<{ id: string; label: string }>;
  /** Scored by only part of the panel, which is worth a look before publishing. */
  partiallyJudged: Array<{ id: string; label: string; judges: number; expected: number }>;
}

export class ResultsCalculator {
  static async calculateEventResults(eventId: string): Promise<EventResults> {
    try {
      // Fetch all data needed for calculation
      const [scoresData, criteriaData, eventData] = await Promise.all([
        this.getEventScores(eventId),
        this.getEventCriteria(eventId),
        this.getEventData(eventId)
      ]);

      const results: ResultData[] = [];
      const absentees: Array<{ id: string; label: string }> = [];
      const partiallyJudged: Array<{ id: string; label: string; judges: number; expected: number }> = [];

      const panelSize = await this.getEventJudgeCount(eventId);

      // An entrant nobody scored did not compete. Ranking them at zero would
      // put an absentee on the results sheet ahead of nobody and below
      // everybody, which is not a placing.
      const record = (
        id: string,
        label: string,
        entrantScores: ScoreData[],
        build: () => ResultData,
      ) => {
        if (entrantScores.length === 0) {
          absentees.push({ id, label });
          return;
        }

        const judges = new Set(entrantScores.map((score) => score.judge_id)).size;
        if (panelSize > 0 && judges < panelSize) {
          partiallyJudged.push({ id, label, judges, expected: panelSize });
        }

        results.push(build());
      };

      if (eventData.event_type === 'individual') {
        const participantsData = await this.getEventParticipants(eventId);

        for (const participant of participantsData) {
          const participantScores = scoresData.filter(s => s.participant_id === participant.id);
          record(
            participant.id,
            `#${participant.chest_number} ${participant.full_name}`,
            participantScores,
            () => this.calculateParticipantResult(participant, participantScores, criteriaData),
          );
        }
      } else {
        const groupsData = await this.getEventGroups(eventId);

        for (const group of groupsData) {
          const groupScores = scoresData.filter(s => s.group_id === group.id);
          record(
            group.id,
            group.name,
            groupScores,
            () => this.calculateGroupResult(group, groupScores, criteriaData),
          );
        }
      }

      // Sort by total score (descending) and handle ties
      results.sort((a, b) => b.total_score - a.total_score);
      
      // Assign ranks and handle ties
      this.assignRanks(results);

      return {
        event_id: eventId,
        results,
        total_participants: results.length,
        criteria: criteriaData,
        last_calculated: new Date(),
        absentees,
        partiallyJudged,
      };
    } catch (error) {
      console.error('Error calculating event results:', error);
      throw error;
    }
  }

  private static async getEventScores(eventId: string): Promise<ScoreData[]> {
    const { data, error } = await supabase
      .from('scores')
      .select('*')
      .eq('event_id', eventId)
      .eq('is_locked', true); // Only consider locked scores

    if (error) throw error;
    return data || [];
  }

  /** How many judges the event expects, so partial panels can be spotted. */
  private static async getEventJudgeCount(eventId: string): Promise<number> {
    const { count, error } = await supabase
      .from('event_judges')
      .select('*', { count: 'exact', head: true })
      .eq('event_id', eventId);

    if (error) throw error;
    return count ?? 0;
  }

  private static async getEventCriteria(eventId: string): Promise<CriteriaData[]> {
    const { data, error } = await supabase
      .from('event_criteria')
      .select('*')
      .eq('event_id', eventId);

    if (error) throw error;
    return data || [];
  }

  private static async getEventData(eventId: string): Promise<{ event_type: string }> {
    const { data, error } = await supabase
      .from('events')
      .select('event_type')
      .eq('id', eventId)
      .single();

    if (error) throw error;
    return data || { event_type: 'individual' };
  }

  private static async getEventParticipants(eventId: string): Promise<ParticipantData[]> {
    const { data, error } = await supabase
      .from('event_participants')
      .select(`
        participants (
          id,
          full_name,
          chest_number,
          church,
          district
        )
      `)
      .eq('event_id', eventId);

    if (error) throw error;
    return data?.map(ep => ep.participants).filter(Boolean) || [];
  }

  private static async getEventGroups(eventId: string): Promise<GroupData[]> {
    const { data, error } = await supabase
      .from('event_groups')
      .select(`
        group:groups (
          id,
          name,
          description,
          members:group_members(
            participant:participants(
              full_name,
              chest_number,
              church
            )
          )
        )
      `)
      .eq('event_id', eventId);

    if (error) throw error;
    return data?.map(eg => eg.group).filter(Boolean) || [];
  }

  private static calculateParticipantResult(
    participant: ParticipantData,
    scores: ScoreData[],
    criteria: CriteriaData[]
  ): ResultData {
    const criteria_scores: { [criteriaId: string]: number } = {};
    const weighted_scores: { [criteriaId: string]: number } = {};

    // Calculate average score for each criteria across all judges
    for (const criterion of criteria) {
      const criteriaScores = scores.filter(s => s.criteria_id === criterion.id);
      
      if (criteriaScores.length > 0) {
        const averageScore = criteriaScores.reduce((sum, s) => sum + s.score, 0) / criteriaScores.length;
        criteria_scores[criterion.id] = averageScore;
        weighted_scores[criterion.id] = averageScore * criterion.weight;
      } else {
        criteria_scores[criterion.id] = 0;
        weighted_scores[criterion.id] = 0;
      }
    }

    // Calculate total weighted score
    const total_score = Object.values(weighted_scores).reduce((sum, score) => sum + score, 0);
    
    // Calculate average score (unweighted)
    const average_score = Object.values(criteria_scores).reduce((sum, score) => sum + score, 0) / criteria.length;

    return {
      participant_id: participant.id,
      participant,
      criteria_scores,
      weighted_scores,
      total_score: Math.round(total_score * 100) / 100, // Round to 2 decimal places
      average_score: Math.round(average_score * 100) / 100,
      rank: 0 // Will be assigned later
    };
  }

  private static calculateGroupResult(
    group: GroupData,
    scores: ScoreData[],
    criteria: CriteriaData[]
  ): ResultData {
    const criteria_scores: { [criteriaId: string]: number } = {};
    const weighted_scores: { [criteriaId: string]: number } = {};

    // Calculate average score for each criteria across all judges
    for (const criterion of criteria) {
      const criteriaScores = scores.filter(s => s.criteria_id === criterion.id);
      
      if (criteriaScores.length > 0) {
        const averageScore = criteriaScores.reduce((sum, s) => sum + s.score, 0) / criteriaScores.length;
        criteria_scores[criterion.id] = averageScore;
        weighted_scores[criterion.id] = averageScore * criterion.weight;
      } else {
        criteria_scores[criterion.id] = 0;
        weighted_scores[criterion.id] = 0;
      }
    }

    // Calculate total weighted score
    const total_score = Object.values(weighted_scores).reduce((sum, score) => sum + score, 0);
    
    // Calculate average score (unweighted)
    const average_score = Object.values(criteria_scores).reduce((sum, score) => sum + score, 0) / criteria.length;

    return {
      group_id: group.id,
      group,
      criteria_scores,
      weighted_scores,
      total_score: Math.round(total_score * 100) / 100, // Round to 2 decimal places
      average_score: Math.round(average_score * 100) / 100,
      rank: 0 // Will be assigned later
    };
  }

  private static assignRanks(results: ResultData[]): void {
    let currentRank = 1;
    
    for (let i = 0; i < results.length; i++) {
      if (i > 0 && results[i].total_score !== results[i - 1].total_score) {
        currentRank = i + 1;
      }
      
      results[i].rank = currentRank;
      
      // Mark tied participants
      if (i > 0 && results[i].total_score === results[i - 1].total_score) {
        results[i].tie_breaker_reason = `Tied with ${currentRank === 1 ? 'winner' : `rank ${currentRank}`}`;
      }
    }
  }

  static async saveEventResults(eventResults: EventResults): Promise<void> {
    try {
      // One transaction on the server: the old results only disappear if the
      // new ones land. Two separate requests could leave an event with scores
      // but no placings.
      const { error } = await supabase.rpc('replace_event_results', {
        p_event_id: eventResults.event_id,
        p_results: eventResults.results.map(result => ({
          participant_id: result.participant_id ?? '',
          group_id: result.group_id ?? '',
          total_score: result.total_score,
          average_score: result.average_score,
          rank: result.rank,
          tie_breaker_reason: result.tie_breaker_reason ?? '',
        })),
      });

      if (error) throw error;
    } catch (error) {
      console.error('Error saving event results:', error);
      throw error;
    }
  }

  static async calculateAndSaveEventResults(eventId: string): Promise<EventResults> {
    const results = await this.calculateEventResults(eventId);
    await this.saveEventResults(results);
    return results;
  }
}