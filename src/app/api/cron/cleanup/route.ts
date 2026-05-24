import { NextRequest, NextResponse } from 'next/server';
import { ReservationService } from '@/services/reservationService';

export async function GET(req: NextRequest) {
  try {
    // Optional Security: Verify an authorization token from your cron provider 
    // to prevent random users from hitting this endpoint repeatedly.
    const authHeader = req.headers.get('authorization');
    if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fire off the background service execution
    const result = await ReservationService.cleanupExpiredReservations();

    if (!result.success) {
      return NextResponse.json({ error: 'Cleanup cycle failed execution' }, { status: 500 });
    }

    return NextResponse.json({
      message: 'Cleanup cycle executed successfully.',
      processedCount: result.processedCount,
    }, { status: 200 });

  } catch (error) {
    console.error('Error in cron route:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
