import { EventEmitter } from 'events';
import { Table } from 'console-table-printer';
import chalk from 'chalk';
import { DateTime } from 'luxon';

interface FundingRateOpportunity {
  symbol: string;
  longExchange: string;
  shortExchange: string;
  longRate: number;
  shortRate: number;
  rawSpread: number;
  intervals: string;
  nextFunding: string;
  timeUntil: string;
  synced: boolean;
}

export class FundingRateScreener extends EventEmitter {
  private opportunities: FundingRateOpportunity[] = [];
  private lastUpdate: DateTime = DateTime.now();

  constructor() {
    super();
  }

  public addOpportunity(opportunity: FundingRateOpportunity): void {
    this.opportunities.push(opportunity);
    this.emit('update', opportunity);
  }

  public updateOpportunities(opportunities: FundingRateOpportunity[]): void {
    this.opportunities = opportunities;
    this.lastUpdate = DateTime.now();
    this.emit('update', opportunities);
  }

  public clearOpportunities(): void {
    this.opportunities = [];
    this.emit('clear');
  }

  public printOpportunities(): void {
    console.clear();
    console.log(chalk.cyan(`Top ${this.opportunities.length} Funding Rate Arbitrage Opportunities:`));
    console.log(chalk.gray(`${this.lastUpdate.toFormat('yyyy-MM-dd HH:mm:ss')} - INFO - ${'-'.repeat(150)}`));
    
    const table = new Table({
      columns: [
        { name: 'symbol', title: 'Symbol', alignment: 'left' },
        { name: 'longExchange', title: 'Long Exchange', alignment: 'left' },
        { name: 'shortExchange', title: 'Short Exchange', alignment: 'left' },
        { name: 'longRate', title: 'Long Rate', alignment: 'right' },
        { name: 'shortRate', title: 'Short Rate', alignment: 'right' },
        { name: 'rawSpread', title: 'Raw Spread', alignment: 'right' },
        { name: 'intervals', title: 'Intervals', alignment: 'center' },
        { name: 'nextFunding', title: 'Next Funding', alignment: 'center' },
        { name: 'timeUntil', title: 'Time Until', alignment: 'right' },
        { name: 'synced', title: 'Synced', alignment: 'center' }
      ]
    });

    this.opportunities.forEach(opp => {
      const formattedOpp = {
        ...opp,
        longRate: `${(opp.longRate * 100).toFixed(4)}%`,
        shortRate: `${(opp.shortRate * 100).toFixed(4)}%`,
        rawSpread: `${(opp.rawSpread * 100).toFixed(4)}%`,
        synced: opp.synced ? '✓' : 'X'
      };

      // Color coding based on spread
      const row = {
        ...formattedOpp,
        color: opp.rawSpread > 0.01 ? 'green' : 
               opp.rawSpread > 0.005 ? 'yellow' : 
               'white'
      };

      table.addRow(row);
    });

    table.printTable();
    console.log(chalk.gray('-'.repeat(150)));
  }

  public getTopOpportunities(limit: number = 10): FundingRateOpportunity[] {
    return [...this.opportunities]
      .sort((a, b) => b.rawSpread - a.rawSpread)
      .slice(0, limit);
  }

  public startAutoRefresh(intervalMs: number = 5000): void {
    setInterval(() => {
      this.printOpportunities();
    }, intervalMs);
  }

  public formatTimeUntil(nextFundingTime: DateTime): string {
    const now = DateTime.now();
    const diff = nextFundingTime.diff(now, ['hours', 'minutes']);
    return `${Math.floor(diff.hours)}h${Math.floor(diff.minutes)}m`;
  }

  public calculateSyncStatus(
    longExchange: string,
    shortExchange: string,
    lastUpdate: DateTime
  ): boolean {
    // Consider exchanges synced if data is less than 1 minute old
    const maxAgeMs = 60 * 1000;
    return DateTime.now().diff(lastUpdate).milliseconds < maxAgeMs;
  }
} 