// app/api/balance/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { Coinbase, ExternalAddress, StakeOptionsMode } from '@coinbase/coinbase-sdk';
import path from 'path';

export async function POST(request: NextRequest) {
    try {
        const { walletAddress } = await request.json();

        // Configure Coinbase SDK with your API key
        const apiKeyPath = path.join(process.cwd(), 'cdp_api_key.json');
        Coinbase.configureFromJson({ filePath: apiKeyPath });

        // Create an external address on the Ethereum Hoodi testnet
        const address = new ExternalAddress(
            Coinbase.networks.EthereumHoodi,
            walletAddress
        );

        // Check stakeable balance
        const stakeableBalance = await address.stakeableBalance(
            Coinbase.assets.Eth,
            StakeOptionsMode.PARTIAL
        );

        return NextResponse.json({
            success: true,
            walletAddress,
            stakeableBalance: stakeableBalance.toString(),
            network: 'Ethereum Holesky Testnet'
        });
    } catch (error: any) {
        console.error('Balance check error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to check balance' },
            { status: 500 }
        );
    }
}
