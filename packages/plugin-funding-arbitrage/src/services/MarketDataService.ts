import { logger } from "../utils/logger";
import { ExchangeConnector } from "../connectors";
import { MarketData } from "../types";
import { DateTime } from "luxon";
import Decimal from "decimal.js";

export interface FundingRateData {
    symbol: string;
    exchange: string;
    fundingRate: Decimal;
    timestamp: number;
}

export interface MarketPriceData {
    symbol: string;
    exchange: string;
    price: Decimal;
    timestamp: number;
}

export interface ArbitrageOpportunity {
    symbol: string;
    longExchange: string;
    shortExchange: string;
    fundingDiff: Decimal;
    expectedProfit: Decimal;
    timestamp: number;
}

export class MarketDataService {
    private connectors: Map<string, ExchangeConnector>;
    private fundingRates: Map<string, FundingRateData>;
    private marketPrices: Map<string, MarketPriceData>;
    private lastUpdate: DateTime;

    constructor(connectors: Map<string, ExchangeConnector>) {
        this.connectors = connectors;
        this.fundingRates = new Map();
        this.marketPrices = new Map();
        this.lastUpdate = DateTime.now();
    }

    async fetchMarketData(symbols: string[]): Promise<void> {
        try {
            const promises: Promise<void>[] = [];

            for (const symbol of symbols) {
                for (const [exchange, connector] of this.connectors) {
                    promises.push(this.updateExchangeData(symbol, exchange, connector));
                }
            }

            await Promise.all(promises);
            this.lastUpdate = DateTime.now();
        } catch (error) {
            logger.error("Error updating market data:", error);
            throw error;
        }
    }

    private async updateExchangeData(
        symbol: string,
        exchange: string,
        connector: ExchangeConnector
    ): Promise<void> {
        try {
            const [fundingRate, marketData] = await Promise.all([
                connector.fetchFundingRate(symbol),
                connector.fetchMarketData(symbol)
            ]);

            const key = `${exchange}:${symbol}`;

            this.fundingRates.set(key, {
                symbol,
                exchange,
                fundingRate,
                timestamp: Date.now()
            });

            this.marketPrices.set(key, {
                symbol,
                exchange,
                price: marketData.lastPrice,
                timestamp: marketData.timestamp
            });
        } catch (error) {
            logger.error(`Error updating ${exchange} data for ${symbol}:`, error);
        }
    }

    findArbitrageOpportunities(
        symbols: string[],
        minFundingDiff: number,
        minProfitThreshold: number
    ): ArbitrageOpportunity[] {
        const opportunities: ArbitrageOpportunity[] = [];

        for (const symbol of symbols) {
            const symbolOpportunities = this.findSymbolOpportunities(
                symbol,
                minFundingDiff,
                minProfitThreshold
            );
            opportunities.push(...symbolOpportunities);
        }

        return opportunities;
    }

    private findSymbolOpportunities(
        symbol: string,
        minFundingDiff: number,
        minProfitThreshold: number
    ): ArbitrageOpportunity[] {
        const opportunities: ArbitrageOpportunity[] = [];
        const exchanges = Array.from(this.connectors.keys());

        for (let i = 0; i < exchanges.length; i++) {
            for (let j = i + 1; j < exchanges.length; j++) {
                const exchange1 = exchanges[i];
                const exchange2 = exchanges[j];

                const key1 = `${exchange1}:${symbol}`;
                const key2 = `${exchange2}:${symbol}`;

                const fundingRate1 = this.fundingRates.get(key1);
                const fundingRate2 = this.fundingRates.get(key2);
                const price1 = this.marketPrices.get(key1);
                const price2 = this.marketPrices.get(key2);

                if (!fundingRate1 || !fundingRate2 || !price1 || !price2) {
                    continue;
                }

                const fundingDiff = fundingRate1.fundingRate.minus(fundingRate2.fundingRate);
                const priceDiff = price1.price.minus(price2.price).abs();
                const avgPrice = price1.price.add(price2.price).div(2);
                const priceDeviation = priceDiff.div(avgPrice);

                // Calculate expected profit considering both funding rate difference and price deviation
                const expectedProfit = fundingDiff.abs().minus(priceDeviation);

                if (
                    fundingDiff.abs().gt(minFundingDiff) &&
                    expectedProfit.gt(minProfitThreshold)
                ) {
                    opportunities.push({
                        symbol,
                        longExchange: fundingDiff.lt(0) ? exchange1 : exchange2,
                        shortExchange: fundingDiff.lt(0) ? exchange2 : exchange1,
                        fundingDiff: fundingDiff.abs(),
                        expectedProfit,
                        timestamp: Date.now()
                    });
                }
            }
        }

        return opportunities;
    }

    getLatestMarketData(symbol: string, exchange: string): MarketData | undefined {
        const key = `${exchange}:${symbol}`;
        const price = this.marketPrices.get(key);
        const fundingRate = this.fundingRates.get(key);

        if (!price || !fundingRate) {
            return undefined;
        }

        return {
            symbol,
            exchange,
            lastPrice: price.price,
            fundingRate: fundingRate.fundingRate,
            timestamp: price.timestamp
        };
    }

    getFundingRate(symbol: string, exchange: string): FundingRateData | undefined {
        return this.fundingRates.get(`${exchange}:${symbol}`);
    }

    getMarketPrice(symbol: string, exchange: string): MarketPriceData | undefined {
        return this.marketPrices.get(`${exchange}:${symbol}`);
    }

    getLastUpdate(): DateTime {
        return this.lastUpdate;
    }
} 