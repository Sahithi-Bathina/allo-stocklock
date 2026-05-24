'use client';

import React, { useState, useEffect } from 'react';

interface CheckoutFormProps {
  productId: string;
  warehouseId: string;
  quantity: number;
  onSuccess?: () => void;
}

export default function CheckoutForm({ productId, warehouseId, quantity, onSuccess }: CheckoutFormProps) {
  const [loading, setLoading] = useState(false);
  const [reservation, setReservation] = useState<any>(null);
  const [timeLeft, setTimeLeft] = useState<number | null>(null); // Track seconds remaining
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Countdown timer logic that runs once a stock lock is successfully acquired
  useEffect(() => {
    if (!reservation || !reservation.expiresAt) return;

    const calculateTimeLeft = () => {
      const difference = new Date(reservation.expiresAt).getTime() - new Date().getTime();
      return Math.max(0, Math.floor(difference / 1000));
    };

    // Initial calculation
    setTimeLeft(calculateTimeLeft());

    const timer = setInterval(() => {
      const remaining = calculateTimeLeft();
      setTimeLeft(remaining);

      if (remaining <= 0) {
        clearInterval(timer);
        setReservation(null);
        setErrorMessage('Your 10-minute reservation has expired. Please try again.');
      }
    }, 1000);

    return () => clearInterval(timer);
  }, [reservation]);

  // Handle the reservation request
  const handleHoldInventory = async () => {
    setLoading(true);
    setErrorMessage(null);

    try {
      const response = await fetch('/api/reservations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ productId, warehouseId, quantity }),
      });

      const data = await response.json();

      if (!response.ok) {
        if (response.status === 409) {
          throw new Error('Out of Stock: Someone else just grabbed these items or warehouse stock is insufficient.');
        }
        throw new Error(data.error || data.message || 'Something went wrong.');
      }

      // Success: Stock locked securely via PostgreSQL FOR UPDATE
      setReservation(data.reservation);
      if (onSuccess) onSuccess();

    } catch (err: any) {
      setErrorMessage(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Helper formatting to display mm:ss string
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };

  return (
    <div className="p-6 max-w-md mx-auto bg-white rounded-xl shadow-md border border-gray-100 space-y-4">
      <div className="text-xl font-bold text-gray-800">Complete Your Checkout</div>
      <p className="text-sm text-gray-500">Items requested: <span className="font-semibold text-gray-700">{quantity} units</span></p>

      {errorMessage && (
        <div className="p-3 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg">
          {errorMessage}
        </div>
      )}

      {!reservation ? (
        <button
          onClick={handleHoldInventory}
          disabled={loading || quantity <= 0}
          className="w-full py-2.5 px-4 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 text-white font-medium rounded-lg transition"
        >
          {loading ? 'Securing Stock Allocations...' : 'Reserve Items & Proceed'}
        </button>
      ) : (
        <div className="space-y-4 animate-fadeIn">
          <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg space-y-1">
            <div className="text-sm font-semibold">✓ Stock Secured Successfully!</div>
            <div className="text-xs">Your items are holding inside our warehouse pool.</div>
          </div>

          {timeLeft !== null && (
            <div className="flex items-center justify-between p-3 bg-amber-50 border border-amber-200 text-amber-800 text-sm rounded-lg font-medium">
              <span>Checkout Window Expiry Timer:</span>
              <span className="font-mono bg-amber-100 px-2 py-0.5 rounded text-base font-bold text-amber-900">
                {formatTime(timeLeft)}
              </span>
            </div>
          )}

          <button
            onClick={() => alert('Integrating Stripe/Razorpay payment gateway next!')}
            className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg shadow transition"
          >
            Pay with Credit Card
          </button>
        </div>
      )}
    </div>
  );
}
