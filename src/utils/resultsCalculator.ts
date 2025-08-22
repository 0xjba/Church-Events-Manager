import { supabase } from '@/integrations/supabase/client';

export interface ScoreData {
  id: string;
  participant_id: string;
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
  category: string;
  church: string;
  district: string;
}

export interface ResultData {
  participant_id: string;
  participant: ParticipantData;
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
}

export class ResultsCalculator {
  static async calculateEventResults(eventId: string): Promise<EventResults> {
    try {
      // Fetch all data needed for calculation
      const [scoresData, criteriaData, participantsData] = await Promise.all([
        this.getEventScores(eventId),
        this.getEventCriteria(eventId),
        this.getEventParticipants(eventId)
      ]);

      // Calculate results for each participant
      const results: ResultData[] = [];

      for (const participant of participantsData) {
        const participantScores = scoresData.filter(s => s.participant_id === participant.id);
        const result = this.calculateParticipantResult(participant, participantScores, criteriaData);
        results.push(result);
      }

      // Sort by total score (descending) and handle ties
      results.sort((a, b) => b.total_score - a.total_score);
      
      // Assign ranks and handle ties
      this.assignRanks(results);

      return {
        event_id: eventId,
        results,
        total_participants: participantsData.length,
        criteria: criteriaData,
        last_calculated: new Date()
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

  private static async getEventCriteria(eventId: string): Promise<CriteriaData[]> {
    const { data, error } = await supabase
      .from('event_criteria')
      .select('*')
      .eq('event_id', eventId);

    if (error) throw error;
    return data || [];
  }

  private static async getEventParticipants(eventId: string): Promise<ParticipantData[]> {
    const { data, error } = await supabase
      .from('event_participants')
      .select(`
        participants (
          id,
          full_name,
          chest_number,
          category,
          church,
          district
        )
      `)
      .eq('event_id', eventId);

    if (error) throw error;
    return data?.map(ep => ep.participants).filter(Boolean) || [];
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
      // Delete existing results for this event
      await supabase
        .from('results')
        .delete()
        .eq('event_id', eventResults.event_id);

      // Insert new results
      const resultsToInsert = eventResults.results.map(result => ({
        event_id: eventResults.event_id,
        participant_id: result.participant_id,
        total_score: result.total_score,
        average_score: result.average_score,
        rank: result.rank,
        tie_breaker_reason: result.tie_breaker_reason,
        calculated_at: eventResults.last_calculated.toISOString()
      }));

      const { error } = await supabase
        .from('results')
        .insert(resultsToInsert);

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

  static async getChampionshipStandings(eventIds: string[]): Promise<{
    participants: Array<{
      participant: ParticipantData;
      events_participated: number;
      total_championship_points: number;
      average_score: number;
      best_rank: number;
      worst_rank: number;
      rank: number;
    }>;
    events_count: number;
  }> {
    try {
      const allResults: { [participantId: string]: any } = {};
      
      // Fetch results for all events
      for (const eventId of eventIds) {
        const { data: eventResults, error } = await supabase
          .from('results')
          .select(`
            *,
            participants (
              id,
              full_name,
              chest_number,
              category,
              church,
              district
            )
          `)
          .eq('event_id', eventId);

        if (error) throw error;

        eventResults?.forEach(result => {
          if (!allResults[result.participant_id]) {
            allResults[result.participant_id] = {
              participant: result.participants,
              events: [],
              total_points: 0,
              total_score: 0,
              ranks: []
            };
          }

          // Championship points: 1st = 100, 2nd = 90, 3rd = 80, etc.
          const points = Math.max(110 - (result.rank * 10), 10);
          
          allResults[result.participant_id].events.push({
            event_id: eventId,
            rank: result.rank,
            score: result.total_score,
            points
          });
          
          allResults[result.participant_id].total_points += points;
          allResults[result.participant_id].total_score += result.total_score;
          allResults[result.participant_id].ranks.push(result.rank);
        });
      }

      // Convert to array and calculate championship standings
      const standings = Object.values(allResults).map((participantData: any) => ({
        participant: participantData.participant,
        events_participated: participantData.events.length,
        total_championship_points: participantData.total_points,
        average_score: participantData.total_score / participantData.events.length,
        best_rank: Math.min(...participantData.ranks),
        worst_rank: Math.max(...participantData.ranks),
        rank: 0 // Will be assigned
      }));

      // Sort by championship points and assign ranks
      standings.sort((a, b) => b.total_championship_points - a.total_championship_points);
      standings.forEach((participant, index) => {
        participant.rank = index + 1;
      });

      return {
        participants: standings,
        events_count: eventIds.length
      };
    } catch (error) {
      console.error('Error calculating championship standings:', error);
      throw error;
    }
  }
}