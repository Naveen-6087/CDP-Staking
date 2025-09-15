'use client';
import { useState } from 'react';
import { ConnectKitButton } from 'connectkit';
import { useAccount, useSendTransaction, useSwitchChain } from 'wagmi';
import { hoodi } from 'wagmi/chains';
import { BaseError, parseTransaction } from 'viem';

// A helper type for our transaction object
type UnsignedTx = {
  to: `0x${string}`;
  from: `0x${string}`;
  value: string;
  data: `0x${string}`;
  nonce: number;
  gas: string;
  maxFeePerGas: string;
  maxPriorityFeePerGas: string;
  chainId: number;
};

export default function Staking() {
  const [amount, setAmount] = useState('0.005');
  const [status, setStatus] = useState('Ready to start');
  const [stakeableBalance, setStakeableBalance] = useState('');
  const [unsignedTx, setUnsignedTx] = useState<UnsignedTx | null>(null);
  const [operationId, setOperationId] = useState('');
  const [error, setError] = useState('');
  const [txHash, setTxHash] = useState('');

  const { address, isConnected, chainId } = useAccount();
  const { sendTransaction } = useSendTransaction();
  const { switchChain, isPending: isSwitchingChain } = useSwitchChain();

  // Helper function to ensure we're on the correct chain
  const ensureCorrectChain = async () => {
    if (chainId !== hoodi.id) {
      try {
        await switchChain({ chainId: hoodi.id });
        return true;
      } catch (error) {
        console.error('Failed to switch chain:', error);
        setError('Failed to switch to Hoodi testnet. Please switch manually in your wallet.');
        return false;
      }
    }
    return true;
  };

  const checkBalance = async () => {
    if (!isConnected) {
      setStatus("Please connect wallet first.");
      return;
    }

    const isCorrectChain = await ensureCorrectChain();
    if (!isCorrectChain) {
      return;
    }

    setStatus('Checking stakeable balance...');
    setError('');

    try {
      const response = await fetch('/api/balance', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: address }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      setStakeableBalance(data.stakeableBalance);
      setStatus(`Stakeable balance: ${data.stakeableBalance} ETH`);
    } catch (e: any) {
      setError(e.message);
      setStatus('Failed to check balance');
    }
  };

  const buildStakeOperation = async () => {
    const isCorrectChain = await ensureCorrectChain();
    if (!isCorrectChain) {
      return;
    }

    setStatus('Building stake operation...');
    setError('');
    setUnsignedTx(null);
    setOperationId('');
    setTxHash('');

    try {
      const response = await fetch('/api/stake', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ walletAddress: address, amount }),
      });

      const data = await response.json();

      if (!response.ok) throw new Error(data.error);

      setOperationId(data.operationId);

      // The unsigned transaction is a hex-encoded JSON string
      let parsedTx;
      try {
        const hexString = data.unsignedTransaction;
        const jsonString = Buffer.from(hexString, 'hex').toString('utf8');
        parsedTx = JSON.parse(jsonString);
        console.log('Decoded transaction:', parsedTx);
      } catch (e) {
        console.error('Failed to decode/parse unsigned transaction:', e);
        throw new Error('Invalid transaction format');
      }

      setUnsignedTx(parsedTx);
      setStatus('Stake operation built successfully!');
      console.log('Full operation details:', data);
    } catch (e: any) {
      setError(e.message);
      setStatus('Failed to build stake operation');
    }
  };

//   const startTransaction = async () => {
//     if (!unsignedTx) {
//       setError('No unsigned transaction available');
//       return;
//     }

//     setStatus('Sending transaction...');
//     setError('');

//     try {
//       sendTransaction({
//         to: unsignedTx.to,
//         value: BigInt(unsignedTx.value),
//         data: unsignedTx.data,
//         gas: BigInt(unsignedTx.gas),
//         maxFeePerGas: BigInt(unsignedTx.maxFeePerGas),
//         maxPriorityFeePerGas: BigInt(unsignedTx.maxPriorityFeePerGas),
//       }, {
//         onSuccess: (hash) => {
//           setTxHash(hash);
//           setStatus('Transaction sent successfully!');
//         },
//         onError: (error) => {
//           setError(error.message);
//           setStatus('Transaction failed');
//         }
//       });
//     } catch (e: any) {
//       setError(e.message);
//       setStatus('Transaction failed');
//     }
//   };

  const signAndBroadcast = () => {
    if (!unsignedTx) {
      setError('No unsigned transaction available to sign.');
      return;
    }

    setStatus('Waiting for signature...');
    setError('');
    setTxHash('');

    try {
      // The transaction from Coinbase SDK
      const txRequest = {
        to: unsignedTx.to as `0x${string}`,
        data: unsignedTx.data as `0x${string}`,
        value: BigInt(unsignedTx.value),
        gas: BigInt(unsignedTx.gas),
        maxFeePerGas: BigInt(unsignedTx.maxFeePerGas),
        maxPriorityFeePerGas: BigInt(unsignedTx.maxPriorityFeePerGas),
        chainId: unsignedTx.chainId,
      };

      console.log('Sending transaction:', txRequest);

      sendTransaction(txRequest, {
        onSuccess: (hash: string) => {
          setTxHash(hash);
          setStatus('Transaction broadcasted successfully!');
        },
        onError: (err: any) => {
          console.error('Transaction error:', err);
          if (err instanceof BaseError) {
            setError(err.shortMessage || err.message);
          } else {
            setError(err.message);
          }
          setStatus('Transaction failed or was rejected.');
        }
      });
    } catch (err: any) {
      console.error('Error preparing transaction:', err);
      setError(`Error: ${err.message}`);
      setStatus('Failed to prepare transaction');
    }
  };

  return (
    <div className="min-h-screen bg-black text-white">
      <div className="max-w-4xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-blue-600 bg-clip-text text-transparent">
            CDP Staking Tutorial
          </h1>
          <p className="text-gray-400 text-lg">
            Stake your ETH using the Coinbase Developer Platform
          </p>
        </div>

        {/* Wallet Connection */}
        <div className="bg-gray-900 rounded-xl p-8 mb-8 border border-gray-800">
          <div className="text-center">
            <h2 className="text-xl font-semibold mb-4 text-blue-400">Connect Your Wallet</h2>
            <ConnectKitButton />
            {isConnected && (
              <div className="mt-4 space-y-2">
                <p className="text-green-400 text-sm">
                  ✓ Connected: {address?.slice(0, 6)}...{address?.slice(-4)}
                </p>
                {chainId !== hoodi.id && (
                  <div className="space-y-2">
                    <p className="text-yellow-400 text-sm">
                      ⚠️ Wrong network. Current: {chainId}, Expected: {hoodi.id}
                    </p>
                    <button
                      onClick={() => switchChain({ chainId: hoodi.id })}
                      disabled={isSwitchingChain}
                      className="px-4 py-2 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-400 text-white rounded-lg text-sm transition-colors"
                    >
                      {isSwitchingChain ? 'Switching...' : 'Switch to Hoodi Testnet'}
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        {isConnected && (
          <div className="space-y-8">
            {/* Amount Input */}
            <div className="bg-gray-900 rounded-xl p-8 border border-gray-800">
              <h2 className="text-xl font-semibold mb-6 text-blue-400">Stake Amount</h2>
              <div className="max-w-md">
                <label className="block text-sm font-medium mb-3 text-gray-300">
                  Amount to Stake (ETH)
                </label>
                <input
                  type="number"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="w-full px-4 py-3 bg-gray-800 border border-gray-700 rounded-lg text-white placeholder-gray-400 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all"
                  step="0.001"
                  min="0"
                  placeholder="0.005"
                />
              </div>
            </div>

            {/* Action Buttons */}
            <div className="bg-gray-900 rounded-xl p-8 border border-gray-800">
              <h2 className="text-xl font-semibold mb-6 text-blue-400">Actions</h2>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <button
                  onClick={checkBalance}
                  className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors duration-200 flex items-center justify-center"
                >
                  Check Balance
                </button>
                <button
                  onClick={buildStakeOperation}
                  className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-colors duration-200 flex items-center justify-center"
                >
                  Build Operation
                </button>
                {unsignedTx && (
                  <button
                    onClick={signAndBroadcast}
                    className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-lg font-medium transition-colors duration-200 flex items-center justify-center"
                  >
                    Sign & Broadcast
                  </button>
                )}
              </div>
            </div>

            {/* Status Display */}
            <div className="bg-gray-900 rounded-xl p-8 border border-gray-800">
              <h2 className="text-xl font-semibold mb-6 text-blue-400">Status</h2>
              <div className="bg-gray-800 rounded-lg p-4">
                <p className="text-gray-300">{status}</p>
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="bg-red-900/20 border border-red-500/50 rounded-xl p-6">
                <h3 className="text-red-400 font-semibold mb-2">Error</h3>
                <p className="text-red-300">{error}</p>
              </div>
            )}

            {/* Success Information */}
            {stakeableBalance && (
              <div className="bg-green-900/20 border border-green-500/50 rounded-xl p-6">
                <h3 className="text-green-400 font-semibold mb-2">Stakeable Balance</h3>
                <p className="text-green-300 text-lg">{stakeableBalance} ETH</p>
              </div>
            )}

            {operationId && (
              <div className="bg-blue-900/20 border border-blue-500/50 rounded-xl p-6">
                <h3 className="text-blue-400 font-semibold mb-2">Operation ID</h3>
                <p className="text-blue-300 font-mono text-sm break-all">{operationId}</p>
              </div>
            )}

            {txHash && (
              <div className="bg-purple-900/20 border border-purple-500/50 rounded-xl p-6">
                <h3 className="text-purple-400 font-semibold mb-2">Transaction Hash</h3>
                <p className="text-purple-300 font-mono text-sm break-all">{txHash}</p>
              </div>
            )}

            {/* Transaction Details */}
            {unsignedTx && (
              <div className="bg-gray-900 rounded-xl p-8 border border-gray-800">
                <h2 className="text-xl font-semibold mb-6 text-blue-400">Transaction Details</h2>
                <div className="bg-gray-800 rounded-lg p-4 overflow-auto">
                  <pre className="text-xs text-gray-300 whitespace-pre-wrap">
                    {JSON.stringify(unsignedTx, null, 2)}
                  </pre>
                </div>
              </div>
            )}
          </div>
        )}

        {!isConnected && (
          <div className="text-center py-12">
            <div className="bg-gray-900 rounded-xl p-8 border border-gray-800 max-w-md mx-auto">
              <h3 className="text-lg font-semibold mb-4 text-gray-300">Get Started</h3>
              <p className="text-gray-400 mb-6">
                Connect your wallet to start staking ETH
              </p>
              <ConnectKitButton />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
