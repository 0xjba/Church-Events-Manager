import { EventResults, ResultData } from './resultsCalculator';

export interface ExportData {
  event_name: string;
  results: ResultData[];
  criteria: Array<{
    id: string;
    name: string;
    max_score: number;
    weight: number;
  }>;
  generated_at: string;
}

export class ExportUtils {
  /**
   * Generates CSV data for event results
   */
  static generateCSV(exportData: ExportData): string {
    const headers = [
      'Rank',
      'Participant Name',
      'Chest Number',
      'Category',
      'Church',
      'District',
      'Total Score',
      'Average Score',
      ...exportData.criteria.map(c => c.name),
      ...exportData.criteria.map(c => `${c.name} (Weighted)`),
      'Tie Breaker Reason'
    ];

    const rows = exportData.results.map(result => [
      result.rank.toString(),
      result.participant.full_name,
      result.participant.chest_number,
      result.participant.age_category,
      result.participant.church,
      result.participant.district,
      result.total_score.toString(),
      result.average_score.toString(),
      ...exportData.criteria.map(c => result.criteria_scores[c.id]?.toFixed(2) || '0.00'),
      ...exportData.criteria.map(c => result.weighted_scores[c.id]?.toFixed(2) || '0.00'),
      result.tie_breaker_reason || ''
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    return csvContent;
  }

  /**
   * Generates HTML for printable report
   */
  static generatePrintableHTML(exportData: ExportData): string {
    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${exportData.event_name} - Results Report</title>
    <style>
        body {
            font-family: Arial, sans-serif;
            margin: 20px;
            color: #333;
        }
        .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #333;
            padding-bottom: 20px;
        }
        .event-title {
            font-size: 24px;
            font-weight: bold;
            margin-bottom: 10px;
            color: #2563eb;
        }
        .subtitle {
            font-size: 16px;
            color: #666;
            margin-bottom: 5px;
        }
        .meta-info {
            font-size: 12px;
            color: #888;
            margin-top: 10px;
        }
        .results-table {
            width: 100%;
            border-collapse: collapse;
            margin-top: 20px;
            font-size: 12px;
        }
        .results-table th,
        .results-table td {
            border: 1px solid #ddd;
            padding: 8px;
            text-align: left;
        }
        .results-table th {
            background-color: #f8f9fa;
            font-weight: bold;
            text-align: center;
        }
        .rank-cell {
            text-align: center;
            font-weight: bold;
            font-size: 14px;
        }
        .rank-1 { background-color: #fef3c7; }
        .rank-2 { background-color: #f3f4f6; }
        .rank-3 { background-color: #fde68a; }
        .participant-name {
            font-weight: bold;
        }
        .chest-number {
            color: #666;
            font-size: 11px;
        }
        .score-cell {
            text-align: center;
            font-weight: bold;
        }
        .criteria-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(100px, 1fr));
            gap: 10px;
            margin: 20px 0;
        }
        .criteria-card {
            background: #f8f9fa;
            padding: 10px;
            border-radius: 4px;
            text-align: center;
        }
        .criteria-name {
            font-weight: bold;
            font-size: 11px;
            margin-bottom: 5px;
        }
        .criteria-details {
            font-size: 10px;
            color: #666;
        }
        @media print {
            body { margin: 0; }
            .no-print { display: none; }
        }
        .footer {
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #ddd;
            text-align: center;
            font-size: 10px;
            color: #888;
        }
    </style>
</head>
<body>
    <div class="header">
        <div class="event-title">PYPA Competition Results</div>
        <div class="subtitle">${exportData.event_name}</div>
        <div class="meta-info">
            Generated on ${exportData.generated_at}<br>
            Total Participants: ${exportData.results.length}
        </div>
    </div>

    <div class="criteria-section">
        <h3>Scoring Criteria</h3>
        <div class="criteria-grid">
            ${exportData.criteria.map(criteria => `
                <div class="criteria-card">
                    <div class="criteria-name">${criteria.name}</div>
                    <div class="criteria-details">
                        Max: ${criteria.max_score} | Weight: ${criteria.weight}x
                    </div>
                </div>
            `).join('')}
        </div>
    </div>

    <table class="results-table">
        <thead>
            <tr>
                <th rowspan="2">Rank</th>
                <th rowspan="2">Participant</th>
                <th rowspan="2">Category</th>
                <th rowspan="2">Church</th>
                <th rowspan="2">District</th>
                <th rowspan="2">Total Score</th>
                <th rowspan="2">Average</th>
                <th colspan="${exportData.criteria.length}">Criteria Scores</th>
            </tr>
            <tr>
                ${exportData.criteria.map(c => `<th>${c.name}</th>`).join('')}
            </tr>
        </thead>
        <tbody>
            ${exportData.results.map(result => `
                <tr class="${result.rank <= 3 ? `rank-${result.rank}` : ''}">
                    <td class="rank-cell">
                        ${result.rank === 1 ? '🥇' : result.rank === 2 ? '🥈' : result.rank === 3 ? '🥉' : `#${result.rank}`}
                        ${result.tie_breaker_reason ? '<br><small style="color: #f59e0b;">TIE</small>' : ''}
                    </td>
                    <td>
                        <div class="participant-name">${result.participant.full_name}</div>
                        <div class="chest-number">#${result.participant.chest_number}</div>
                    </td>
                    <td>${result.participant.age_category}</td>
                    <td>${result.participant.church}</td>
                    <td>${result.participant.district}</td>
                    <td class="score-cell">${result.total_score}</td>
                    <td class="score-cell">${result.average_score}</td>
                    ${exportData.criteria.map(c => 
                        `<td class="score-cell">${result.criteria_scores[c.id]?.toFixed(1) || '0.0'}</td>`
                    ).join('')}
                </tr>
            `).join('')}
        </tbody>
    </table>

    <div class="footer">
        <p>
            This report was generated by PYPA (Devotional & Cultural Competitions Platform)<br>
            For official records and verification purposes
        </p>
    </div>

    <script>
        // Auto-print when opened
        window.onload = function() {
            window.print();
        };
    </script>
</body>
</html>`;

    return html;
  }

  /**
   * Downloads CSV file
   */
  static downloadCSV(exportData: ExportData, filename?: string): void {
    const csv = this.generateCSV(exportData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename || `${exportData.event_name.replace(/\s+/g, '_')}_results.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Opens printable report in new window
   */
  static openPrintableReport(exportData: ExportData): void {
    const html = this.generatePrintableHTML(exportData);
    const printWindow = window.open('', '_blank');
    
    if (printWindow) {
      printWindow.document.write(html);
      printWindow.document.close();
    }
  }

  /**
   * Generates championship standings CSV
   */
  static generateChampionshipCSV(championshipData: any): string {
    const headers = [
      'Rank',
      'Participant Name',
      'Chest Number',
      'Category',
      'Church',
      'District',
      'Events Participated',
      'Championship Points',
      'Average Score',
      'Best Rank',
      'Worst Rank'
    ];

    const rows = championshipData.participants.map((participant: any) => [
      participant.rank.toString(),
      participant.participant.full_name,
      participant.participant.chest_number,
      participant.participant.age_category,
      participant.participant.church,
      participant.participant.district,
      participant.events_participated.toString(),
      participant.total_championship_points.toString(),
      participant.average_score.toFixed(2),
      participant.best_rank.toString(),
      participant.worst_rank.toString()
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    return csvContent;
  }

  /**
   * Downloads championship standings CSV
   */
  static downloadChampionshipCSV(championshipData: any, filename?: string): void {
    const csv = this.generateChampionshipCSV(championshipData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename || 'championship_standings.csv');
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  /**
   * Generates winners export CSV for all completed events
   */
  static generateWinnersCSV(winnersData: WinnersExportData): string {
    const headers = [
      'Event Name',
      'Event Type',
      'Age Category',
      'Rank',
      'Participant Name',
      'Chest Number',
      'Church',
      'District',
      'Total Score',
      'Average Score',
      'Tie Breaker Reason'
    ];

    const rows = winnersData.events.flatMap(event => 
      event.winners.map(winner => [
        event.event_name,
        event.event_type,
        event.age_category || 'All Categories',
        winner.rank.toString(),
        winner.participant.full_name,
        winner.participant.chest_number,
        winner.participant.church,
        winner.participant.district,
        winner.total_score.toString(),
        winner.average_score.toString(),
        winner.tie_breaker_reason || ''
      ])
    );

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    return csvContent;
  }

  /**
   * Downloads winners export CSV
   */
  static downloadWinnersCSV(winnersData: WinnersExportData, filename?: string): void {
    const csv = this.generateWinnersCSV(winnersData);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename || `winners_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}

export interface WinnersExportData {
  events: Array<{
    event_id: string;
    event_name: string;
    event_type: string;
    age_category: string | null;
    winners: Array<{
      rank: number;
      total_score: number;
      average_score: number;
      tie_breaker_reason: string | null;
      participant: {
        full_name: string;
        chest_number: string;
        church: string;
        district: string;
      };
    }>;
  }>;
  generated_at: string;
}