import { NextRequest, NextResponse } from 'next/server';
import { ReservationService } from '@/services/reservationService';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { productId, warehouseId, quantity } = body;

    // Quick validation check
    if (!productId || !warehouseId || !quantity || quantity <= 0) {
      return NextResponse.json(
        { error: 'Missing required allocation parameters: productId, warehouseId, and positive quantity.' },
        { status: 400 }
      );
    }

    // Call your concurrency-safe row-locking service
    const result = await ReservationService.reserveProduct(productId, warehouseId, quantity);

    if (!result.success) {
      // Passes back the 409 status cleanly to trigger frontend out-of-stock modals
      return NextResponse.json({ message: result.message }, { status: result.status });
    }

    // Return the created reservation ticket with a 201 status
    return NextResponse.json(
      { 
        message: 'Stock locked successfully for 10 minutes.', 
        reservation: result.reservation 
      }, 
      { status: 201 }
    );

  } catch (error) {
    console.error('Reservation API Route Failure:', error);
    return NextResponse.json(
      { error: 'Internal transactional system failure.' }, 
      { status: 500 }
    );
  }
}