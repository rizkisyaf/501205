import { ExchangeConnector, MarketData, TradeRequest, ExchangeConfig } from "./index";
import { Position } from "../types";
import Decimal from "decimal.js";
import { logger } from "../utils/logger";
import { DateTime } from "luxon";
import { createHmac } from 'crypto';

interface BinanceTickerResponse {
    symbol: string;
    lastPrice: string;
    volume: string;
    time: number;
}

interface BinancePremiumIndexResponse {
    symbol: string;
    lastFundingRate: string;
    nextFundingTime: number;
}

interface BinanceOrderResponse {
    orderId: number;
    symbol: string;
    status: string;
    clientOrderId: string;
    price: string;
    avgPrice: string;
    origQty: string;
    executedQty: string;
    cumQuote: string;
    timeInForce: string;
    type: string;
    reduceOnly: boolean;
    closePosition: boolean;
    side: string;
    positionSide: string;
    stopPrice: string;
    workingType: string;
    priceProtect: boolean;
    origType: string;
    updateTime: number;
}

interface BinancePositionResponse {
    symbol: string;
    positionAmt: string;
    entryPrice: string;
    markPrice: string;
    unRealizedProfit: string;
    liquidationPrice: string;
    leverage: string;
    maxNotionalValue: string;
    marginType: string;
    isolatedMargin: string;
    isAutoAddMargin: string;
    positionSide: string;
    notional: string;
    isolatedWallet: string;
    updateTime: number;
}

interface BinanceBalanceResponse {
    accountAlias: string;
    asset: string;
    balance: string;
    crossWalletBalance: string;
    crossUnPnl: string;
    availableBalance: string;
    maxWithdrawAmount: string;
    marginAvailable: boolean;
    updateTime: number;
}

export class BinanceConnector implements ExchangeConnector {
    readonly exchange = "binance";
    private readonly apiKey: string;
    private readonly apiSecret: string;
    private readonly testnet: boolean;
    private readonly baseUrl: string;

    constructor(config: ExchangeConfig) {
        this.apiKey = config.apiKey || '';
        this.apiSecret = config.apiSecret || '';
        this.testnet = true; // Force testnet for safety
        this.baseUrl = this.getBaseUrl();
        logger.info('Initializing Binance connector with testnet:', { 
            testnet: this.testnet,
            apiKeyLength: this.apiKey.length 
        });
    }

    protected getBaseUrl(): string {
        const url = this.testnet
            ? "https://testnet.binancefuture.com"
            : "https://fapi.binance.com";
        logger.debug(`Using Binance ${this.testnet ? 'testnet' : 'mainnet'} URL: ${url}`);
        return url;
    }

    private getEndpointPath(path: string): string {
        return `/fapi${path}`; // Add /fapi prefix for all endpoints
    }

    private getRecvWindow(): number {
        return this.testnet ? 60000 : 5000;
    }

    private sign(data: string): string {
        return createHmac('sha256', this.apiSecret)
            .update(data)
            .digest('hex');
    }

    private async publicRequest(endpoint: string, params: URLSearchParams = new URLSearchParams()): Promise<any> {
        try {
            const url = `${this.getBaseUrl()}${this.getEndpointPath(endpoint)}`;
            const finalUrl = `${url}?${params.toString()}`;
            
            logger.debug('Making public request:', {
                url: finalUrl,
                testnet: this.testnet
            });

            const response = await fetch(finalUrl);
            const responseText = await response.text();

            if (!response.ok) {
                throw new Error(`Binance API error: ${response.statusText} - ${responseText}`);
            }

            return JSON.parse(responseText);
        } catch (error) {
            logger.error(`Binance API request failed: ${error}`);
            throw error;
        }
    }

    private async signedRequest(endpoint: string, params: URLSearchParams = new URLSearchParams(), method: string = 'GET'): Promise<any> {
        try {
            const timestamp = Date.now().toString();
            params.append('timestamp', timestamp);
            params.append('recvWindow', this.getRecvWindow().toString());

            const signature = this.sign(params.toString());
            params.append('signature', signature);

            const url = `${this.getBaseUrl()}${this.getEndpointPath(endpoint)}`;
            const finalUrl = method === 'GET' ? `${url}?${params.toString()}` : url;
            
            logger.debug('Making signed request:', {
                url: finalUrl,
                method,
                params: params.toString(),
                testnet: this.testnet
            });

            const headers: Record<string, string> = {
                'X-MBX-APIKEY': this.apiKey
            };

            if (method !== 'GET') {
                headers['Content-Type'] = 'application/x-www-form-urlencoded';
            }

            const response = await fetch(finalUrl, {
                method,
                headers,
                ...(method !== 'GET' && { body: params.toString() })
            });

            const responseText = await response.text();
            if (!response.ok) {
                throw new Error(`Binance API error: ${response.statusText} - ${responseText}`);
            }

            return JSON.parse(responseText);
        } catch (error) {
            logger.error(`Binance API request failed: ${error}`);
            throw error;
        }
    }

    async fetchMarketData(symbol: string): Promise<MarketData> {
        try {
            const params = new URLSearchParams({
                symbol: this.normalizeSymbol(symbol)
            });

            const data = await this.publicRequest('/v1/ticker/24hr', params) as BinanceTickerResponse;
            const fundingRate = await this.fetchFundingRate(symbol);
            
            return {
                symbol,
                exchange: this.exchange,
                lastPrice: new Decimal(data.lastPrice),
                fundingRate,
                timestamp: Date.now()
            };
        } catch (error) {
            logger.error("Error fetching Binance market data:", error);
            throw error;
        }
    }

    async fetchFundingRate(symbol: string): Promise<Decimal> {
        try {
            const params = new URLSearchParams({
                symbol: this.normalizeSymbol(symbol)
            });

            const data = await this.publicRequest('/v1/premiumIndex', params) as BinancePremiumIndexResponse;
            return new Decimal(data.lastFundingRate);
        } catch (error) {
            logger.error("Error fetching Binance funding rate:", error);
            throw error;
        }
    }

    async executeTrade(request: TradeRequest): Promise<Position> {
        try {
            // Set leverage first
            await this.setLeverage(request.symbol, request.leverage);

            const params = new URLSearchParams({
                symbol: this.normalizeSymbol(request.symbol),
                side: request.side === "long" ? "BUY" : "SELL",
                type: request.limitPrice ? "LIMIT" : "MARKET",
                quantity: request.size.toString()
            });

            if (request.limitPrice) {
                params.append("price", request.limitPrice.toString());
            }

            const order = await this.signedRequest('/v1/order', params, 'POST') as BinanceOrderResponse;
            
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
            logger.error("Error executing Binance trade:", error);
            throw error;
        }
    }

    async getPosition(symbol: string): Promise<Position | null> {
        try {
            const params = new URLSearchParams({
                symbol: this.normalizeSymbol(symbol)
            });

            const positions = await this.signedRequest('/v2/positionRisk', params) as BinancePositionResponse[];
            const position = positions[0];

            if (!position || Number(position.positionAmt) === 0) {
                return null;
            }

            return {
                symbol,
                exchange: this.exchange,
                side: Number(position.positionAmt) > 0 ? "long" : "short",
                size: new Decimal(Math.abs(Number(position.positionAmt))),
                leverage: Number(position.leverage),
                entryPrice: new Decimal(position.entryPrice),
                unrealizedPnl: new Decimal(position.unRealizedProfit),
                fundingPaid: new Decimal(0),
                openTime: DateTime.fromMillis(Number(position.updateTime)),
                lastUpdateTime: DateTime.now()
            };
        } catch (error) {
            logger.error("Error fetching Binance position:", error);
            throw error;
        }
    }

    async closePosition(symbol: string): Promise<boolean> {
        try {
            const position = await this.getPosition(symbol);
            if (!position) {
                return true; // No position to close
            }

            // Create market order in opposite direction
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
            logger.error("Error closing Binance position:", error);
            return false;
        }
    }

    async getBalance(): Promise<Decimal> {
        try {
            const balances = await this.signedRequest('/v2/balance') as BinanceBalanceResponse[];
            const usdtBalance = balances.find(b => b.asset === "USDT");
            
            if (!usdtBalance) {
                throw new Error("No USDT balance found");
            }

            return new Decimal(usdtBalance.balance);
        } catch (error) {
            logger.error("Error fetching Binance balance:", error);
            throw error;
        }
    }

    async setLeverage(symbol: string, leverage: number): Promise<boolean> {
        try {
            const params = new URLSearchParams({
                symbol: this.normalizeSymbol(symbol),
                leverage: leverage.toString()
            });

            await this.signedRequest('/v1/leverage', params, 'POST');
            return true;
        } catch (error) {
            logger.error("Error setting Binance leverage:", error);
            return false;
        }
    }

    private normalizeSymbol(symbol: string): string {
        // Convert BTC-PERP or BTCUSDT to BTCUSDT for Binance USDⓈ-M Futures
        return symbol.replace('-PERP', '').replace('-', '');
    }
} 