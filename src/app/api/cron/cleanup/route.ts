export const dynamic = 'force-dynamic';

import { NextRequest, NextResponse } from 'next/server';
import { ReservationService } from '@/services/reservationService';

export async function GET(req: NextRequest) {
  try {
    // Optional security protection for cron execution
    const authHeader = req.headers.get('authorization');

    if (
      process.env.CRON_SECRET &&
      authHeader !== `Bearer ${process.env.CRON_SECRET}`
    ) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Cleanup expired reservations
    const result =
      await ReservationService.cleanupExpiredReservations();

    if (!result.success) {
      return NextResponse.json(
        { error: 'Cleanup cycle failed execution' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: 'Cleanup cycle executed successfully.',
        processedCount: result.processedCount,
      },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error in cron route:', error);

    return NextResponse.json(
      { error: 'Internal Server Error' },
      { status: 500 }
    );
  }
}
