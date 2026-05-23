import { NextRequest, NextResponse } from 'next/server';
import { ReservationService } from '@/services/reservationService';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const result = await ReservationService.confirmReservation(id);

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: result.status });
    }

    return NextResponse.json(result.reservation, { status: 200 });
  } catch (error) {
    console.error('Error in confirm API route:', error);
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}