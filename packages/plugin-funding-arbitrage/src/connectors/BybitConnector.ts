import { ExchangeConnector, MarketData, TradeRequest, ExchangeConfig } from "./index";
import { Position } from "../types";
import Decimal from "decimal.js";
import { logger } from "../utils/logger";
import { DateTime } from "luxon";

interface BybitResponse<T> {
    retCode: number;
    retMsg: string;
    result: T;
    time: number;
}

interface BybitTickerResult {
    list: Array<{
        symbol: string;
        lastPrice: string;
        volume24h: string;
        turnover24h: string;
    }>;
}

interface BybitFundingResult {
    list: Array<{
        symbol: string;
        fundingRate: string;
        fundingRateTimestamp: string;
    }>;
}

interface BybitOrderResult {
    orderId: string;
    orderLinkId: string;
    symbol: string;
    price: string;
    qty: string;
    side: string;
    status: string;
}

interface BybitPositionResult {
    list: Array<{
        symbol: string;
        side: string;
        size: string;
        entryPrice: string;
        leverage: string;
        unrealisedPnl: string;
        cumRealisedPnl: string;
        createdTime: number;
    }>;
}

interface BybitBalanceResult {
    list: Array<{
        coin: Array<{
            walletBalance: string;
        }>;
    }>;
}

export class BybitConnector implements ExchangeConnector {
    readonly exchange = "bybit";
    private readonly apiKey: string;
    private readonly apiSecret: string;
    private readonly testnet: boolean;
    private readonly baseUrl: string;

    constructor(config: ExchangeConfig) {
        this.apiKey = config.apiKey;
        this.apiSecret = config.apiSecret;
        this.testnet = config.testnet || false;
        this.baseUrl = this.testnet
            ? "https://api-testnet.bybit.com"
            : "https://api.bybit.com";
    }

    async fetchMarketData(symbol: string): Promise<MarketData> {
        try {
            const response = await fetch(`${this.baseUrl}/v5/market/tickers?category=linear&symbol=${symbol}`);
            if (!response.ok) {
                throw new Error(`Bybit API error: ${response.statusText}`);
            }
            const data = await response.json() as BybitResponse<BybitTickerResult>;
            const ticker = data.result.list[0];
            
            const fundingRate = await this.fetchFundingRate(symbol);
            
            return {
                symbol,
                exchange: this.exchange,
                lastPrice: new Decimal(ticker.lastPrice),
                fundingRate,
                timestamp: Date.now()
            };
        } catch (error) {
            logger.error("Error fetching Bybit market data:", error);
            throw error;
        }
    }

    async fetchFundingRate(symbol: string): Promise<Decimal> {
        try {
            const response = await fetch(`${this.baseUrl}/v5/market/funding/history?category=linear&symbol=${symbol}&limit=1`);
            if (!response.ok) {
                throw new Error(`Bybit API error: ${response.statusText}`);
            }
            const data = await response.json() as BybitResponse<BybitFundingResult>;
            return new Decimal(data.result.list[0].fundingRate);
        } catch (error) {
            logger.error("Error fetching Bybit funding rate:", error);
            throw error;
        }
    }

    async executeTrade(request: TradeRequest): Promise<Position> {
        try {
            // Set leverage first
            await this.setLeverage(request.symbol, request.leverage);

            const timestamp = Date.now().toString();
            const params = new URLSearchParams({
                category: "linear",
                symbol: request.symbol,
                side: request.side === "long" ? "Buy" : "Sell",
                orderType: request.limitPrice ? "Limit" : "Market",
                qty: request.size.toString(),
                timeInForce: "GTC",
                timestamp
            });

            if (request.limitPrice) {
                params.append("price", request.limitPrice.toString());
            }

            const signature = this.sign(params.toString());
            
            const response = await fetch(`${this.baseUrl}/v5/order/create`, {
                method: "POST",
                headers: {
                    "X-BAPI-API-KEY": this.apiKey,
                    "X-BAPI-SIGN": signature,
                    "X-BAPI-TIMESTAMP": timestamp,
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: params
            });

            if (!response.ok) {
                throw new Error(`Bybit API error: ${response.statusText}`);
            }

            const data = await response.json() as BybitResponse<BybitOrderResult>;
            const order = data.result;
            
            return {
                symbol: request.symbol,
                exchange: this.exchange,
                side: request.side,
                size: request.size,
                leverage: request.leverage,
                entryPrice: new Decimal(order.price),
                unrealizedPnl: new Decimal(0),
                fundingPaid: new Decimal(0),
                openTime: DateTime.now(),
                lastUpdateTime: DateTime.now()
            };
        } catch (error) {
            logger.error("Error executing Bybit trade:", error);
            throw error;
        }
    }

    async getPosition(symbol: string): Promise<Position | null> {
        try {
            const timestamp = Date.now().toString();
            const params = new URLSearchParams({
                category: "linear",
                symbol,
                timestamp
            });

            const signature = this.sign(params.toString());
            
            const response = await fetch(`${this.baseUrl}/v5/position/list?${params}`, {
                headers: {
                    "X-BAPI-API-KEY": this.apiKey,
                    "X-BAPI-SIGN": signature,
                    "X-BAPI-TIMESTAMP": timestamp
                }
            });

            if (!response.ok) {
                throw new Error(`Bybit API error: ${response.statusText}`);
            }

            const data = await response.json() as BybitResponse<BybitPositionResult>;
            const position = data.result.list[0];

            if (!position || Number(position.size) === 0) {
                return null;
            }

            return {
                symbol,
                exchange: this.exchange,
                side: position.side.toLowerCase() === "buy" ? "long" : "short",
                size: new Decimal(position.size),
                leverage: Number(position.leverage),
                entryPrice: new Decimal(position.entryPrice),
                unrealizedPnl: new Decimal(position.unrealisedPnl),
                fundingPaid: new Decimal(position.cumRealisedPnl),
                openTime: DateTime.fromMillis(position.createdTime),
                lastUpdateTime: DateTime.now()
            };
        } catch (error) {
            logger.error("Error fetching Bybit position:", error);
            throw error;
        }
    }

    async closePosition(symbol: string): Promise<boolean> {
        try {
            const position = await this.getPosition(symbol);
            if (!position) {
                return true;
            }

            const request: TradeRequest = {
                symbol,
                exchange: this.exchange,
                side: position.side === "long" ? "short" : "long",
                size: position.size,
                leverage: position.leverage
            };

            await this.executeTrade(request);
            return true;
        } catch (error) {
            logger.error("Error closing Bybit position:", error);
            return false;
        }
    }

    async getBalance(): Promise<Decimal> {
        try {
            const timestamp = Date.now().toString();
            const params = new URLSearchParams({
                accountType: "CONTRACT",
                coin: "USDT",
                timestamp
            });

            const signature = this.sign(params.toString());
            
            const response = await fetch(`${this.baseUrl}/v5/account/wallet-balance?${params}`, {
                headers: {
                    "X-BAPI-API-KEY": this.apiKey,
                    "X-BAPI-SIGN": signature,
                    "X-BAPI-TIMESTAMP": timestamp
                }
            });

            if (!response.ok) {
                throw new Error(`Bybit API error: ${response.statusText}`);
            }

            const data = await response.json() as BybitResponse<BybitBalanceResult>;
            return new Decimal(data.result.list[0].coin[0].walletBalance);
        } catch (error) {
            logger.error("Error fetching Bybit balance:", error);
            throw error;
        }
    }

    async setLeverage(symbol: string, leverage: number): Promise<boolean> {
        try {
            const timestamp = Date.now().toString();
            const params = new URLSearchParams({
                category: "linear",
                symbol,
                buyLeverage: leverage.toString(),
                sellLeverage: leverage.toString(),
                timestamp
            });

            const signature = this.sign(params.toString());
            
            const response = await fetch(`${this.baseUrl}/v5/position/set-leverage`, {
                method: "POST",
                headers: {
                    "X-BAPI-API-KEY": this.apiKey,
                    "X-BAPI-SIGN": signature,
                    "X-BAPI-TIMESTAMP": timestamp,
                    "Content-Type": "application/x-www-form-urlencoded"
                },
                body: params
            });

            return response.ok;
        } catch (error) {
            logger.error("Error setting Bybit leverage:", error);
            return false;
        }
    }

    private sign(queryString: string): string {
        const crypto = require('crypto');
        return crypto
            .createHmac('sha256', this.apiSecret)
            .update(queryString)
            .digest('hex');
    }
} 